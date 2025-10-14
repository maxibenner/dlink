defmodule DlinkWeb.MessageController do
  use DlinkWeb, :controller
  require Logger

  @root Application.compile_env(:dlink, :data_root, "inbox")
  @read_opts [length: 64_000, read_timeout: 30_000]

  # POST /v1/inbox/:key/:client
  # Body: raw bytes (e.g., audio/ogg). Saves atomically as "<recipient>.ogg".
  def upload(conn, %{"key" => key, "client" => client}) do
    File.mkdir_p!(inbox_dir(key))
    tmp = Path.join(inbox_dir(key), "#{client}.ogg.part")
    final = Path.join(inbox_dir(key), "#{client}.ogg")
    {:ok, fd} = File.open(tmp, [:write, :raw, :binary])

    case stream_to_fd(conn, fd, 0) do
      {:ok, total, conn1} ->
        File.close(fd)
        File.rename!(tmp, final)
        json(conn1, %{to: client, bytes: total})

      {:error, :timeout, conn1} ->
        File.close(fd)
        File.rm(tmp)
        send_resp(conn1, 408, "timeout")
    end
  end

  # GET /v1/inbox/:key/:client  -> boolean
  # Presence is simply "does <client>.ogg exist?"
  def inbox(conn, %{"key" => key, "client" => client}) do
    Logger.debug("running")
    file_path = Path.join([inbox_dir(key), "#{client}.ogg"])
    Logger.debug(file_path)

    case File.ls(inbox_dir(key)) do
      {:ok, files} ->
        Logger.debug("Files")
        Logger.debug(files)

        cond do
          "#{client}.ogg" in files ->
            {:ok, bin} = File.read(file_path)
            data = Base.encode64(bin)
            File.rm(file_path)
            json(conn, %{data: data, message: "Message found in inbox.", code: "INCOMING"})

          length(files) > 0 ->
            json(conn, %{
              data: nil,
              message: "No incoming message found. Outgoing message present.",
              code: "OUTGOING"
            })

          true ->
            json(conn, %{
              data: nil,
              message: "No incoming or outgoing messages found.",
              code: "EMPTY"
            })
        end

      {:error, reason} ->
        json(conn, reason)
    end
  end

  ## helpers
  defp inbox_dir(key), do: Path.join([@root, key])

  defp stream_to_fd(conn, fd, acc) do
    case Plug.Conn.read_body(conn, @read_opts) do
      {:ok, chunk, conn1} ->
        if chunk != "", do: :ok = IO.binwrite(fd, chunk)
        # final chunk
        {:ok, acc + byte_size(chunk), conn1}

      {:more, chunk, conn1} ->
        :ok = IO.binwrite(fd, chunk)
        stream_to_fd(conn1, fd, acc + byte_size(chunk))

      {:error, :timeout} ->
        {:error, :timeout, conn}
    end
  end
end
