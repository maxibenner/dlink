defmodule DlinkWeb.RootController do
  use DlinkWeb, :controller

  @index_path :dlink
               |> :code.priv_dir()
               |> to_string()
               |> Path.join("static/index.html")

  def show(conn, _params) do
    conn
    |> put_resp_content_type("text/html; charset=utf-8")
    |> send_file(200, @index_path)
  end
end
