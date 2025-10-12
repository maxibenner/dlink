defmodule DlinkWeb.Router do
  use DlinkWeb, :router

  pipeline :api do
    plug CORSPlug, origin: "http://localhost:5000"
    plug :accepts, ["json"]
  end

  scope "/v1", DlinkWeb do
    pipe_through :api
    post "/inbox/:key/:client", MessageController, :upload
    get "/inbox/:key/:client", MessageController, :inbox
  end
end
