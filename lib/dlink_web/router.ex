defmodule DlinkWeb.Router do
  use DlinkWeb, :router

  pipeline :api do
    plug CORSPlug, origin: "http://localhost:5000"
    plug :accepts, ["json"]
  end

  scope "/v1", DlinkWeb do
    pipe_through :api
    # Message inbox status
    get "/:owner/inbox", MessageController, :status
    # CRUD for messages
    get "/:owner/inbox/message", MessageController, :download
    post "/:owner/inbox/message", MessageController, :upload
    delete "/:owner/inbox/message", MessageController, :delete
  end
end
