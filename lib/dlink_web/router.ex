defmodule DlinkWeb.Router do
  use DlinkWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/v1", DlinkWeb do
    pipe_through :api
    post "/clients/:from/messages", MessageController, :upload
    get "/clients/:id/inbox", MessageController, :inbox
    get "/clients/:id/next", MessageController, :next
  end
end
