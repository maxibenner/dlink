defmodule DlinkWeb.MessageController do
  use DlinkWeb, :controller

  @pairs Application.compile_env(:dlink, :pairs, %{})
  @root Application.compile_env(:dlink, :data_root, "data")
  @ns Application.compile_env(:dlink, :inbox_ns, "inbox")
  @read_opts [length: 64_000, read_timeout: 30_000]

  # POST /v1/clients/:from/messages
  # Body: raw bytes (e.g., audio/ogg). Saves atomically as "<recipient>.ogg".
  def upload(conn, %{"from" => from}) do
    case Map.fetch(@pairs, from) do
      {:ok, to} ->
        File.mkdir_p!(inbox_dir())
        tmp = Path.join(inbox_dir(), "#{to}.ogg.part")
        final = Path.join(inbox_dir(), "#{to}.ogg")
        {:ok, fd} = File.open(tmp, [:write, :raw, :binary])

        total =
          case stream_to_fd(conn, fd, 0) do
            {:ok, bytes} -> bytes
            {:halt, _c} -> throw(:early_halt)
          end

        File.close(fd)
        # atomic finalize
        File.rename!(tmp, final)
        json(conn, %{to: to, bytes: total})

      :error ->
        send_resp(conn, 404, "unknown client")
    end
  catch
    :early_halt -> conn
  end

  # GET /v1/clients/:id/inbox  -> {has: boolean}
  # Presence is simply "does <id>.ogg exist?"
  def inbox(conn, %{"id" => id}) do
    json(conn, %{has: File.exists?(path_for(id))})
  end

  # GET /v1/clients/:id/next   -> returns bytes and deletes; 204 if none
  def next(conn, %{"id" => id}) do
    path = path_for(id)

    if File.exists?(path) do
      {:ok, bin} = File.read(path)
      # delete after reading
      File.rm(path)

      conn
      |> put_resp_header("content-type", "audio/ogg")
      |> put_resp_header("content-disposition", ~s(attachment; filename="#{id}.ogg"))
      |> send_resp(200, bin)
    else
      send_resp(conn, 204, "")
    end
  end

  ## helpers

  defp inbox_dir, do: Path.join([@root, @ns])
  defp path_for(id), do: Path.join(inbox_dir(), "#{id}.ogg")

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
