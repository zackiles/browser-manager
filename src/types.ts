export interface CDPProxySessionInfo {
  clientId: string // Identifies a client connected to this proxy, e.g., "client-123"
  sessionId: string // Unique CDP session ID, e.g., "session-abc123"
  targetId: string // CDP target ID, e.g., "target-xyz789"
  type: 'page' | 'worker' | 'iframe' | 'other' // Type of target, e.g., "page"
}

export interface CDPProxySessionManager {
  /** The WebSocket URL of the real browser CDP endpoint
   * example: "ws://localhost:9222/devtools/browser/b0b8a4fb-bb17-4359-9533-a8d9f3908bd8"
   */
  browserWebSocketDebuggerUrl: string

  /** Active client connections (clientId -> WebSocket)
   * example: { "client-123": WebSocket }
   */
  clientConnections: Map<string, WebSocket>

  /** Active CDP Sessions (targetId -> SessionInfo)
   * example: { "target-xyz789": { clientId: "client-123", sessionId: "session-abc123", type: "page" } }
   */
  activeSessions: Map<string, CDPProxySessionInfo>

  /** Intercepts WebSocket messages from clients
   * example: interceptClientMessage("client-123", { id: 1, method: "Page.enable", params: {} })
   * notes:
   * - Parses and optionally modifies the message before forwarding
   * - Logs or filters messages based on proxy rules
   */
  interceptClientMessage(clientId: string, message: any): Promise<any>

  /** Intercepts WebSocket messages from the browser
   * example: interceptBrowserMessage("client-123", { id: 1, result: {} })
   * notes:
   * - Modifies or drops responses before forwarding to the client
   * - Can be used for debugging or request manipulation
   */
  interceptBrowserMessage(clientId: string, message: any): Promise<any>

  /** Forwards messages from the client to the real browser CDP
   * example: forwardToBrowser("client-123", { id: 2, method: "Network.enable", params: {} })
   * notes:
   * - Calls `interceptClientMessage` before sending
   * - Sends via `clientConnections.get(clientId)`
   */
  forwardToBrowser(clientId: string, message: any): Promise<void>

  /** Forwards messages from the browser to the appropriate client
   * example: forwardToClient("client-123", { id: 2, result: {} })
   * notes:
   * - Calls `interceptBrowserMessage` before sending
   * - Routes message using `clientConnections.get(clientId)`
   */
  forwardToClient(clientId: string, message: any): Promise<void>

  /** Registers a new client connection
   * example: registerClient("client-123", new WebSocket("ws://localhost:3000"))
   * notes:
   * - Adds client to `clientConnections`
   * - Sets up WebSocket event listeners for cleanup
   */
  registerClient(clientId: string, ws: WebSocket): void

  /** Closes and cleans up a client's connection
   * example: closeClient("client-123")
   * notes:
   * - Removes from `clientConnections`
   * - Closes any active CDP sessions linked to `clientId`
   */
  closeClient(clientId: string): Promise<void>

  /** Closes all clients and tears down the proxy session
   * example: close()
   * notes:
   * - Iterates through `clientConnections` and calls `closeClient`
   * - Shuts down the proxy WebSocket and clears state
   */
  close(): Promise<void>

  /** Lists all active CDP targets (pages, workers, etc.)
   * example: listTargets("client-123") -> [{ targetId: "target-xyz789", type: "page" }]
   * notes:
   * - Filters `activeSessions` by `clientId` if provided
   */
  listTargets(clientId?: string): Promise<{ targetId: string; type: string }[]>

  /** Event listeners (e.g., on session attach/detach, request modification)
   * example: on("sessionCreated", (data) => console.log("Session created:", data))
   * notes:
   * - Enables external hooks for logging or modifying behavior
   */
  on(
    event:
      | 'clientConnected'
      | 'clientDisconnected'
      | 'sessionCreated'
      | 'sessionClosed'
      | 'messageIntercepted',
    listener: (data: any) => void,
  ): void
}
