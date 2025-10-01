defmodule Dlink.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      DlinkWeb.Telemetry,
      {DNSCluster, query: Application.get_env(:dlink, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: Dlink.PubSub},
      # Start a worker by calling: Dlink.Worker.start_link(arg)
      # {Dlink.Worker, arg},
      # Start to serve requests, typically the last entry
      DlinkWeb.Endpoint
    ]

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: Dlink.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    DlinkWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
