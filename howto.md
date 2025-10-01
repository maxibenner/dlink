**Ultra-minimal, beginner-first guide** where each message is just **one file named only by the recipient id**. No counters, no message IDs. If a file named `<recipient>.ogg` exists, that _is_ the pending message. Sending again simply **overwrites** the previous message for that recipient. Popping **returns the bytes and deletes** the file.

- **HTTP-only**, **no auth**
- **Streamed upload** (no big buffers)
- **Single shared folder** for all messages
- **Hard-coded pairs** (who can talk to whom)
- **Recipient polls every ~30s**
- **Filename = recipient id** (e.g. `B.ogg`)

---

# 0) Create a tiny Phoenix API app

```bash
mix archive.install hex phx_new
mix phx.new dlink --no-html --no-live --no-gettext --no-dashboard --no-ecto
cd dlink
mix deps.get
```

---

# 1) Minimal config

`config/config.exs`

```elixir
import Config

config :dlink, data_root: "data", inbox_ns: "inbox"

# Hardcoded pairs (edit to your needs)
config :dlink, pairs: %{"A" => "B", "B" => "A"}
```

---

# 2) Router (3 tiny endpoints)

`lib/dlink_web/router.ex`

```elixir
defmodule DlinkWeb.Router do
  use DlinkWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/v1", DlinkWeb do
    pipe_through :api
    post "/clients/:from/messages", MessageController, :upload  # sender -> write <recipient>.ogg
    get  "/clients/:id/inbox",      MessageController, :inbox   # recipient -> has message?
    get  "/clients/:id/next",       MessageController, :next    # recipient -> pop (read+delete)
  end
end
```

---

# 3) Single, tiny controller (all logic here)

`lib/dlink_web/controllers/message_controller.ex`

```elixir
defmodule DlinkWeb.MessageController do
  use DlinkWeb, :controller

  @pairs Application.compile_env(:dlink, :pairs, %{})
  @root  Application.compile_env(:dlink, :data_root, "data")
  @ns    Application.compile_env(:dlink, :inbox_ns, "inbox")
  @read_opts [length: 64_000, read_timeout: 30_000]

  # POST /v1/clients/:from/messages
  # Body: raw bytes (e.g., audio/ogg). Saves atomically as "<recipient>.ogg".
  def upload(conn, %{"from" => from}) do
    case Map.fetch(@pairs, from) do
      {:ok, to} ->
        File.mkdir_p!(inbox_dir())
        tmp   = Path.join(inbox_dir(), "#{to}.ogg.part")
        final = Path.join(inbox_dir(), "#{to}.ogg")
        {:ok, fd} = File.open(tmp, [:write, :raw, :binary])

        total =
          case stream_to_fd(conn, fd, 0) do
            {:ok, bytes} -> bytes
            {:halt, _c}  -> throw(:early_halt)
          end

        File.close(fd)
        File.rename!(tmp, final)         # atomic finalize
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
      File.rm(path)  # delete after reading
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
        {:ok, acc + byte_size(chunk)}              # final chunk
      {:more, chunk, conn2} ->
        IO.binwrite(fd, chunk)
        stream_to_fd(conn2, fd, acc + byte_size(chunk))
      {:error, :timeout} ->
        send_resp(conn, 408, "timeout"); {:halt, conn}
    end
  end
end
```

**Plain-English behavior:**

- **Send**: `POST /v1/clients/A/messages` writes **`B.ogg`** if `A → B`. If `B.ogg` already exists, it’s **overwritten** (newest wins).
- **Presence**: `GET /v1/clients/B/inbox` returns `{ "has": true }` iff `B.ogg` exists.
- **Pop**: `GET /v1/clients/B/next` returns the bytes of `B.ogg` and **deletes** it.

---

# 4) Run it

```bash
mix phx.server
# http://localhost:4000
```

Files appear under `./data/inbox/`.

---

# 5) Quick test (assuming pair "A" <-> "B")

**Send:**

```bash
curl -X POST \
  -H "Content-Type: application/octet-stream" \
  --data-binary @voice.ogg \
  http://localhost:4000/v1/clients/A/messages
# => { "to":"B", "bytes":123456 }
# creates/overwrites ./data/inbox/B.ogg
```

**Check presence:**

```bash
curl http://localhost:4000/v1/clients/B/inbox
# => { "has": true }
```

**Pop (download & delete):**

```bash
curl -o msg.ogg http://localhost:4000/v1/clients/B/next
# 200 OK with audio bytes; file ./data/inbox/B.ogg is now deleted
```

**Check again:**

```bash
curl http://localhost:4000/v1/clients/B/inbox
# => { "has": false }
```

---

## Notes (kept super simple)

- **Uploads**: use `application/octet-stream` (or your specific audio type).
- **Atomic write**: we stream to `*.part` then rename to `<recipient>.ogg`.
- **Overwrite semantics**: only one pending message per recipient; new uploads replace the previous one.
- **Polling**: call `/inbox` every ~30s; if `has:true`, call `/next`.
- **To change pairs**: edit `config :dlink, :pairs`.

That’s it — minimal lines, minimal concepts, maximum clarity.
