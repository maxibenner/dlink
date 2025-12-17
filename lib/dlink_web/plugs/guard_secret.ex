defmodule DlinkWeb.Plugs.GuardSecret do
  @behaviour Plug

  import Plug.Conn

  @impl Plug
  def init(opts), do: opts

  @impl Plug
  def call(conn, _opts) do
    guard_secret = Application.fetch_env!(:dlink, :guard_secret)
    owner_id = Map.get(conn.path_params, "owner")

    cond do
      guard_secret in [nil, ""] ->
        conn

      not is_binary(owner_id) ->
        conn

      String.contains?(owner_id, guard_secret) ->
        conn

      true ->
        conn
        |> put_resp_content_type("application/json")
        |> send_resp(:forbidden, ~s({"error":"invalid_owner"}))
        |> halt()
    end
  end
end
