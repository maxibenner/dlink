defmodule DlinkWeb.MessageController do
  use DlinkWeb, :controller
  require Logger

  @root Application.compile_env(:dlink, :data_root, "inbox")
  @read_opts [length: 64_000, read_timeout: 30_000]

  ##############################################################
  # Make sure client keys are limited to prevent rouge uploads #
  ##############################################################

  # POST /v1/upload/:owner
  # Body: raw bytes (e.g., audio/ogg). Saves atomically as "<recipient>.ogg".
  def upload(conn, %{"owner" => owner}) do
    tmp = Path.join(@root, "#{owner}.ogg.part")
    final = Path.join(@root, "#{owner}.ogg")
    {:ok, fd} = File.open(tmp, [:write, :raw, :binary])

    case stream_to_fd(conn, fd, 0) do
      {:ok, total, conn1} ->
        File.close(fd)
        File.rename!(tmp, final)
        json(conn1, %{to: owner, bytes: total})

      {:error, :timeout, conn1} ->
        File.close(fd)
        File.rm(tmp)
        send_resp(conn1, 408, "timeout")
    end
  end

  # GET /v1/download/:owner  -> file
  # Serves <owner>.ogg if it exists
  def download(conn, %{"owner" => owner}) do
    file_path = Path.join(@root, "#{owner}.ogg")

    if File.exists?(file_path) do
      conn
      |> put_resp_content_type("audio/ogg")
      |> send_file(200, file_path)
    else
      send_resp(conn, 404, "not found")
    end
  end

  # GET /v1/inbox/:owner  -> boolean
  # Checks if <owner>.ogg exists
  def status(conn, %{"owner" => owner}) do
    Logger.debug("running")
    file_path = Path.join([@root, "#{owner}.ogg"])
    Logger.debug(file_path)
    exists? = File.exists?(file_path)
    json(conn, exists?)
  end

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
