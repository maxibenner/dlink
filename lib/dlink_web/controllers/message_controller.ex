defmodule DlinkWeb.MessageController do
  use DlinkWeb, :controller

  @root Application.compile_env(:dlink, :data_root, "inbox")
  @read_opts [length: 64_000, read_timeout: 30_000]

  # POST /v1/inbox/:key/:client
  # Body: raw bytes (e.g., audio/ogg). Saves atomically as "<recipient>.ogg".
  def upload(conn, %{"key" => key, "client" => client}) do
    File.mkdir_p!(inbox_dir(key))
    tmp = Path.join(inbox_dir(key), "#{client}.ogg.part")
    final = Path.join(inbox_dir(key), "#{client}.ogg")
    {:ok, fd} = File.open(tmp, [:write, :raw, :binary])

    total =
      case stream_to_fd(conn, fd, 0) do
        {:ok, bytes} -> bytes
        {:halt, _c} -> throw(:early_halt)
      end

    File.close(fd)
    # atomic finalize
    File.rename!(tmp, final)
    json(conn, %{to: client, bytes: total})
  catch
    :early_halt -> conn
  end

  # GET /v1/inbox/:key/:client  -> {has: boolean}
  # Presence is simply "does <id>.ogg exist?"
  def inbox(conn, %{"key" => key, "client" => client}) do
    has_message =
      Path.join(inbox_dir(key), "#{client}.ogg")
      |> File.exists?()

    json(conn, %{has: has_message})
  end

  ## helpers
  defp inbox_dir(key), do: Path.join([@root, key])

  defp stream_to_fd(conn, fd, acc) do
    case Plug.Conn.read_body(conn, @read_opts) do
      {:ok, chunk, _conn} ->
        if chunk != "", do: IO.binwrite(fd, chunk)
        # final chunk
        {:ok, acc + byte_size(chunk)}

      {:more, chunk, conn2} ->
        IO.binwrite(fd, chunk)
        stream_to_fd(conn2, fd, acc + byte_size(chunk))

      {:error, :timeout} ->
        send_resp(conn, 408, "timeout")
        {:halt, conn}
    end
  end
end
