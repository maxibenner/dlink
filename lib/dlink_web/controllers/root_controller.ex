defmodule DlinkWeb.RootController do
  use DlinkWeb, :controller

  def show(conn, _params) do
    index_path =
      :dlink
      |> :code.priv_dir()
      |> Path.join("static/index.html")

    conn
    |> put_resp_content_type("text/html; charset=utf-8")
    |> send_file(200, index_path)
  end
end
