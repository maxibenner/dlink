defmodule DlinkWeb.Router do
  use DlinkWeb, :router

  pipeline :api do
    plug CORSPlug, origin: "http://localhost:5000"
    plug :accepts, ["json"]
  end

  scope "/v1", DlinkWeb do
    pipe_through :api
    get "/status/:owner", MessageController, :status
    get "/download/:owner", MessageController, :download
    post "/upload/:owner", MessageController, :upload
  end
end
