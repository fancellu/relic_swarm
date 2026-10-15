// tslint:disable
/* eslint-disable */

/**
 * Returns the player count requested via `?players=N` (for local testing), or
 * 1 if it is missing or not a positive integer.
 */
function getRequestedPlayersCount(): number {
  const requested = Number(
    new URLSearchParams(window.location.search).get('players') ?? '1',
  );
  return Number.isInteger(requested) && requested > 0 ? requested : 1;
}

/**
 * Fake Playground SDK for local single-device testing.
 *
 * The top-level instance only sets up split-screen when
 * `window.__PLAYGROUND_MULTIPLAYER__ === true` (set by the multiplayer SDK
 * hook) or the URL has `?players=N` (N > 1). Otherwise it runs as a solo host
 * in the current window, so single-player games are never taken over.
 *
 * In split-screen mode it replaces the page with a grid of player iframes
 * (Player 1 is the host) and an "Add Guest Player" button (up to 4 players).
 * Each iframe gets `window.__PLAYER_ID__` and `window.__PLAYERS_COUNT__`
 * injected, and the players sync locally over a BroadcastChannel.
 */
export class FakePlaygroundSDK {
  private isInitialized = false;
  private onGameEvent: ((event: any) => void) | null = null;
  private onPlayerPresence: ((presence: any) => void) | null = null;
  private onLobbyStatus: ((status: any) => void) | null = null;
  private onError: ((error: any) => void) | null = null;

  private lobbyId = 'fake-lobby-123';
  private gameId = 'fake-game-456';

  // My local identity (determined dynamically or injected)
  private myPlayerId = 'player-1';
  private isHost = true;

  // The shared players list in the lobby
  private players: any[] = [];

  private channel!: BroadcastChannel;
  private joinIntervalId: any = null;
  private playersCount = 1;

  constructor() {
    // Check if we are a child iframe player instance
    const injectedPlayerId = (window as any).__PLAYER_ID__;

    if (injectedPlayerId) {
      console.log(
        `📱 [Fake SDK] Initializing Player Instance: ${injectedPlayerId}`,
      );
      this.myPlayerId = injectedPlayerId;
      this.isHost = injectedPlayerId === 'player-1';

      // Connect to the shared broadcast channel
      this.channel = new BroadcastChannel(`playground-lobby-${this.lobbyId}`);
      this.channel.onmessage = (event) =>
        this._handleChannelMessage(event.data);
    } else {
      console.log(
        '📱 [Fake SDK] Initializing Split-Screen Container Manager...',
      );
    }
  }

  /**
   * Initializes the SDK.
   */
  async init(
    onGameEvent: (event: any) => void,
    onPlayerPresence: (presence: any) => void,
    onLobbyStatus?: (status: any) => void,
    onError?: (error: any) => void,
  ): Promise<void> {
    if (this.isInitialized) {
      console.warn('⚠️ [Fake SDK] Already initialized.');
      throw new Error('SDK is already initialized.');
    }

    const injectedPlayerId = (window as any).__PLAYER_ID__;

    // IF WE ARE THE PARENT CONTAINER (no player ID injected):
    if (!injectedPlayerId) {
      if (this._isSplitScreenEnabled()) {
        // Multiplayer game: trigger split-screen viewport orchestration.
        console.log(
          '📱 [Fake SDK] Split-screen container active. Orchestrating viewports...',
        );
        this._setupSplitScreen();
        // Return a promise that never resolves to block this parent instance
        // from running any further game initialization.
        return new Promise(() => {});
      }
      // Single-player game: never hijack the page with split-screen. Run as a
      // solo host directly in this window instead.
      console.log(
        '📱 [Fake SDK] Single-player game detected. Running as solo host (no split-screen).',
      );
    }

    // IF WE ARE A CHILD PLAYER INSTANCE (or a solo host):
    this.onGameEvent = onGameEvent;
    this.onPlayerPresence = onPlayerPresence;
    if (onLobbyStatus) this.onLobbyStatus = onLobbyStatus;
    if (onError) this.onError = onError;
    this.isInitialized = true;

    // Read injected total players count (child iframes always have it injected;
    // a solo host defaults to 1 so no placeholder guests are announced).
    const injectedPlayersCount = (window as any).__PLAYERS_COUNT__ || 1;
    this.playersCount = injectedPlayersCount;

    console.log(
      `🚀 [Fake SDK] Player ${this.myPlayerId} of ${this.playersCount} initialized.`,
    );

    // Notify parent frame (Chat UI) that preview is ready
    window.parent.postMessage({type: 'PREVIEW_READY'}, '*');

    if (this.isHost) {
      // Host initializes the lobby with placeholders for all guest players
      this.players = [
        this._createPlayer('player-1', 'Player 1 (Host)', true, true),
      ];
      for (let i = 2; i <= this.playersCount; i++) {
        this.players.push(
          this._createPlayer(
            `player-${i}`,
            `Player ${i} (Waiting...)`,
            false,
            false,
          ),
        );
      }

      // Trigger presence join for all players
      for (const p of this.players) {
        this._triggerPresence('JOIN', p);
      }
    } else {
      // Guest pings to join periodically until accepted (robust handshake)
      const playerIndex = this.myPlayerId.split('-')[1];
      console.log(
        `📡 [Fake SDK] Player ${playerIndex} starting connection handshake...`,
      );
      this.joinIntervalId = setInterval(() => {
        console.log(`📡 [Fake SDK] Player ${playerIndex} pinging Host...`);
        this._broadcast({
          type: 'PLAYER_JOINED_REQUEST',
          playerId: this.myPlayerId,
        });
      }, 300);
    }
  }

  /**
   * Simulates lobby creation (for the Host).
   */
  createLobby(callback: (lobbyInfo: any) => void): void {
    console.log('📝 [Fake SDK] createLobby called.');
    const lobbyInfo = this._getLobbyInfo('WAITING_FOR_PLAYERS');
    setTimeout(() => callback(lobbyInfo), 100);
  }

  /**
   * Simulates fetching lobby info.
   */
  getLobby(arg1: any, arg2?: any): void {
    let callback: (lobbyInfo: any) => void;
    let lobbyId: string | undefined;

    if (typeof arg1 === 'function') {
      callback = arg1;
      lobbyId = arg2;
    } else {
      lobbyId = arg1;
      callback = arg2;
    }

    console.log(`🔍 [Fake SDK] getLobby called.`);
    const lobbyInfo = this._getLobbyInfo(
      this.players.length >= 2 ? 'GAME_IN_PROGRESS' : 'WAITING_FOR_PLAYERS',
    );
    if (typeof callback === 'function') {
      setTimeout(() => callback(lobbyInfo), 100);
    }
  }

  /**
   * Simulates presence updates. Supports dynamic argument signatures and optional callbacks.
   */
  updatePlayerPresence(arg1: any, arg2?: any, arg3?: any): void {
    let action: string = 'JOIN';
    let callback: ((success: boolean) => void) | undefined;

    if (typeof arg1 === 'string') {
      action = arg1;
      if (typeof arg2 === 'function') callback = arg2;
      else if (typeof arg3 === 'function') callback = arg3;
    } else if (typeof arg1 === 'function') {
      callback = arg1;
    }

    console.log(`👤 [Fake SDK] updatePlayerPresence: ${action}`);
    if (typeof callback === 'function') {
      setTimeout(() => callback!(true), 100);
    }
  }

  /**
   * Starts the game.
   */
  startGame(lobbyId?: string): void {
    console.log(`🎬 [Fake SDK] startGame called.`);
    this._broadcast({
      type: 'START_GAME',
      lobbyId: this.lobbyId,
    });
    this._triggerLobbyStatus('GAME_IN_PROGRESS');
  }

  /**
   * Broadcasts game events to the other iframe.
   */
  sendGameEvent(eventData: any): void {
    console.log('📤 [Fake SDK] Sending game event:', eventData);
    this._broadcast({
      type: 'GAME_EVENT',
      event: eventData,
      from: this.myPlayerId,
    });
  }

  scoreUpdated(scoreData: any): void {
    console.log('🏆 [Fake SDK] scoreUpdated:', scoreData);
    const me = this.players.find((p) => p.playerId === this.myPlayerId);
    if (me) {
      me.score = scoreData.value || 0;
    }
    this._broadcast({
      type: 'SCORE_UPDATED',
      playerId: this.myPlayerId,
      scoreData,
    });
  }

  levelComplete(level: number | string): void {
    console.log(`⭐ [Fake SDK] levelComplete: Level ${level}`);
    this._broadcast({type: 'LEVEL_COMPLETE', level});
  }

  gameOver(lobbyId?: string): void {
    console.log(`🛑 [Fake SDK] gameOver called.`);
    this._broadcast({type: 'GAME_OVER', lobbyId});
    this._triggerLobbyStatus('GAME_ENDED');
    this._showMockLeaderboard();
  }

  pauseStateChanged(isPaused: boolean): void {
    console.log(`⏸️ [Fake SDK] pauseStateChanged: isPaused=${isPaused}`);
    this._broadcast({type: 'PAUSE_STATE_CHANGED', isPaused});
  }

  private _showMockLeaderboard() {
    if (document.getElementById('mock-leaderboard-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'mock-leaderboard-overlay';

    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      backgroundColor: 'rgba(10, 10, 12, 0.95)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: '100000',
      color: '#ffffff',
      fontFamily:
        'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: '20px',
    });

    const card = document.createElement('div');
    Object.assign(card.style, {
      backgroundColor: '#18181b',
      border: '1px solid #27272a',
      borderRadius: '24px',
      padding: '32px',
      width: '100%',
      maxWidth: '400px',
      boxShadow:
        '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(6, 182, 212, 0.15)',
      textAlign: 'center',
      position: 'relative',
    });

    const title = document.createElement('h2');
    title.innerText = '🏆 Global Leaderboard';
    Object.assign(title.style, {
      margin: '0 0 8px 0',
      fontSize: '24px',
      fontWeight: '900',
      background: 'linear-gradient(to right, #facc15, #06b6d4)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      textTransform: 'uppercase',
      letterSpacing: '1.5px',
    });
    card.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.innerText = 'Playground SDK - Local Simulation';
    Object.assign(subtitle.style, {
      margin: '0 0 24px 0',
      fontSize: '11px',
      color: '#71717a',
      textTransform: 'uppercase',
      letterSpacing: '1px',
      fontWeight: '700',
    });
    card.appendChild(subtitle);

    const list = document.createElement('div');
    Object.assign(list.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      marginBottom: '28px',
    });

    // Sort active players by score descending
    const sortedPlayers = [...this.players].sort(
      (a, b) => (b.score || 0) - (a.score || 0),
    );

    const realPlayers = sortedPlayers.map((p, idx) => {
      let rankLabel = `${idx + 1}`;
      if (idx === 0) rankLabel = `🥇 1`;
      else if (idx === 1) rankLabel = `🥈 2`;
      else if (idx === 2) rankLabel = `🥉 3`;

      let displayName = p.displayName;
      if (displayName.includes('Waiting')) {
        displayName =
          p.playerId === 'player-1' ? 'Player 1 (Host)' : 'Player 2 (Guest)';
      }

      return {
        rank: rankLabel,
        name: displayName,
        score: `${p.score || 0} pts`,
        active: p.playerId === this.myPlayerId,
      };
    });

    const leaderboardData = [...realPlayers];
    const lastRealScore =
      sortedPlayers.length > 0
        ? sortedPlayers[sortedPlayers.length - 1].score || 0
        : 0;

    const mockGlobal = [
      {name: 'Spectator_Alpha', scoreOffset: -100},
      {name: 'Casual_Gamer', scoreOffset: -250},
      {name: 'Speedrunner_99', scoreOffset: -400},
    ];

    mockGlobal.forEach((mock) => {
      const rank = leaderboardData.length + 1;
      let rankLabel = `${rank}`;
      if (rank === 2) rankLabel = `🥈 2`;
      else if (rank === 3) rankLabel = `🥉 3`;

      const mockScore = Math.max(0, lastRealScore + mock.scoreOffset);

      leaderboardData.push({
        rank: rankLabel,
        name: mock.name,
        score: `${mockScore} pts`,
        active: false,
      });
    });

    leaderboardData.forEach((p) => {
      const row = document.createElement('div');
      Object.assign(row.style, {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        backgroundColor: p.active ? 'rgba(6, 182, 212, 0.08)' : '#09090b',
        border: p.active
          ? '1px solid rgba(6, 182, 212, 0.3)'
          : '1px solid #27272a',
        borderRadius: '12px',
        fontSize: '14px',
      });

      const playerInfo = document.createElement('div');
      Object.assign(playerInfo.style, {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontWeight: p.active ? '700' : '500',
        color: p.active ? '#22d3ee' : '#e4e4e7',
      });

      const rankSpan = document.createElement('span');
      rankSpan.innerText = p.rank;
      Object.assign(rankSpan.style, {
        fontFamily: 'monospace',
        minWidth: '24px',
      });
      playerInfo.appendChild(rankSpan);

      const nameSpan = document.createElement('span');
      nameSpan.innerText = p.name;
      playerInfo.appendChild(nameSpan);
      row.appendChild(playerInfo);

      const scoreSpan = document.createElement('span');
      scoreSpan.innerText = p.score;
      Object.assign(scoreSpan.style, {
        fontWeight: '900',
        fontFamily: 'monospace',
        color: p.active ? '#22d3ee' : '#a1a1aa',
      });
      row.appendChild(scoreSpan);

      list.appendChild(row);
    });
    card.appendChild(list);

    const closeBtn = document.createElement('button');
    closeBtn.innerText = 'Dismiss Leaderboard';
    Object.assign(closeBtn.style, {
      width: '100%',
      padding: '12px 0',
      backgroundColor: '#27272a',
      border: 'none',
      borderRadius: '12px',
      color: '#ffffff',
      fontWeight: '700',
      fontSize: '13px',
      cursor: 'pointer',
      transition: 'all 0.15s ease-in-out',
    });
    closeBtn.onclick = () => {
      overlay.remove();
    };
    card.appendChild(closeBtn);

    overlay.appendChild(card);
    document.body.appendChild(overlay);
  }

  showLeaderboard(lobbyId?: string): void {
    console.log(`📊 [Fake SDK] showLeaderboard called.`);
  }

  // --- Split Screen Orchestration ---

  /**
   * Split-screen (multi-viewport) orchestration is only meaningful for
   * multiplayer games. It must be opted into explicitly, either by the
   * multiplayer SDK hook (`window.__PLAYGROUND_MULTIPLAYER__ = true`) or via
   * `?players=N` (N > 1) for local testing. Single-player games must never be
   * hijacked by it.
   */
  private _isSplitScreenEnabled(): boolean {
    if ((window as any).__PLAYGROUND_MULTIPLAYER__ === true) {
      return true;
    }
    return getRequestedPlayersCount() > 1;
  }

  private _setupSplitScreen() {
    // Capture the entire compiled HTML document
    const html = document.documentElement.outerHTML;

    // Read desired players count from query params (default: 1)
    // We start with 1 by default, meaning no split screen initially unless requested or clicked!
    const playersCount = getRequestedPlayersCount();
    const maxPlayers = 4;
    console.log(
      `📱 [Fake SDK] Setting up dashboard for ${playersCount} players (max ${maxPlayers})...`,
    );

    // Clear the parent document body completely
    document.body.innerHTML = '';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.overflow = 'hidden';
    document.body.style.backgroundColor = '#111'; // Dark dashboard background

    // Create a grid container to hold the viewports dynamically
    const container = document.createElement('div');
    container.style.display = 'grid';
    container.style.height = '100vh';
    container.style.width = '100vw';
    container.style.gap = '2px'; // Subtle divider lines
    container.style.backgroundColor = '#222'; // Divider color

    // Configure Grid Columns/Rows based on initial player count
    const updateGridLayout = (count: number) => {
      if (count <= 1) {
        container.style.gridTemplateColumns = '1fr';
        container.style.gridTemplateRows = '1fr';
      } else if (count === 2) {
        container.style.gridTemplateColumns = '1fr';
        container.style.gridTemplateRows = '1fr 1fr'; // Vertically stacked
      } else {
        container.style.gridTemplateColumns = '1fr 1fr';
        container.style.gridTemplateRows = `repeat(${Math.ceil(
          count / 2,
        )}, 1fr)`;
      }
    };
    updateGridLayout(playersCount);

    const iframes: HTMLIFrameElement[] = [];

    // Helper to inject the global variables into the iframe's head before loading
    const injectGlobals = (
      htmlStr: string,
      playerId: string,
      totalPlayers: number,
    ) => {
      return htmlStr.replace(
        '<head>',
        `<head><script>
          window.__PLAYER_ID__="${playerId}";
          window.__PLAYERS_COUNT__=${totalPlayers};
        </script>`,
      );
    };

    // Spawn an iframe player instance
    const spawnPlayerIframe = (playerId: string, totalPlayers: number) => {
      const iframe = document.createElement('iframe');
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = 'none';
      iframe.style.margin = '0';
      iframe.style.padding = '0';
      iframe.style.overflow = 'hidden';
      iframe.style.backgroundColor = '#000';
      return iframe;
    };

    // Add Host player immediately
    const hostIframe = spawnPlayerIframe('player-1', playersCount);
    container.appendChild(hostIframe);
    iframes.push(hostIframe);
    document.body.appendChild(container);

    // Load Host content
    console.log('📱 [Fake SDK] Loading Player 1 (Host) immediately...');
    hostIframe.srcdoc = injectGlobals(html, 'player-1', playersCount);

    // Watchdog and Guest loading orchestration
    let watchdogTimer: any = null;
    let gameStarted = false;
    let isParentChannelClosed = false;

    const parentChannel = new BroadcastChannel(
      `playground-lobby-${this.lobbyId}`,
    );

    const checkAndCloseChannel = () => {
      if (
        !isParentChannelClosed &&
        gameStarted &&
        iframes.length >= maxPlayers
      ) {
        console.log('📱 [Fake SDK] Parent channel closed.');
        parentChannel.close();
        isParentChannelClosed = true;
      }
    };

    parentChannel.onmessage = (event) => {
      if (event.data && event.data.type === 'START_GAME') {
        console.log(
          '📱 [Fake SDK] Parent detected GAME_STARTED. Clearing watchdog.',
        );
        gameStarted = true;
        if (watchdogTimer) {
          clearTimeout(watchdogTimer);
          watchdogTimer = null;
        }
        checkAndCloseChannel();
      }
    };

    const startWatchdog = (totalCount: number) => {
      if (gameStarted) return;
      if (watchdogTimer) clearTimeout(watchdogTimer);
      watchdogTimer = setTimeout(() => {
        if (!gameStarted) {
          console.warn(
            '⚠️ [Fake SDK] Some players stuck connecting! Reloading all Guest iframes...',
          );
          for (let i = 2; i <= totalCount; i++) {
            if (iframes[i - 1]) {
              iframes[i - 1].srcdoc = injectGlobals(
                html,
                `player-${i}`,
                totalCount,
              );
            }
          }
          startWatchdog(totalCount);
        }
      }, 4000);
    };

    // Load initial guests if starting with N > 1
    if (playersCount > 1) {
      setTimeout(() => {
        console.log(
          `📱 [Fake SDK] Loading ${
            playersCount - 1
          } Guest players after delay...`,
        );
        for (let i = 2; i <= playersCount; i++) {
          const guestIframe = spawnPlayerIframe(`player-${i}`, playersCount);
          container.appendChild(guestIframe);
          iframes.push(guestIframe);
          guestIframe.srcdoc = injectGlobals(html, `player-${i}`, playersCount);
        }
        startWatchdog(playersCount);
      }, 500);
    }

    // Render Floating Action Button to dynamically add a player!
    const btn = document.createElement('button');
    btn.innerText = '➕ Add Guest Player';
    btn.style.position = 'fixed';
    btn.style.top = '50%';
    btn.style.left = '50%';
    btn.style.transform = 'translate(-50%, -50%)';
    btn.style.padding = '12px 24px';
    btn.style.backgroundColor = '#0f9d58'; // Google Green
    btn.style.color = '#fff';
    btn.style.border = 'none';
    btn.style.borderRadius = '24px';
    btn.style.fontFamily = 'sans-serif';
    btn.style.fontWeight = 'bold';
    btn.style.fontSize = '14px';
    btn.style.cursor = 'pointer';
    btn.style.boxShadow = '0 6px 12px rgba(0,0,0,0.4)';
    btn.style.zIndex = '99999';
    btn.style.transition = 'all 0.2s ease';

    // Helper function to lock the button state
    const lockButtonActive = () => {
      btn.disabled = true;
      btn.style.opacity = '0.5';
      btn.style.cursor = 'not-allowed';
      btn.style.backgroundColor = '#555';
      btn.innerText = '🔒 Split Screen Active';
    };

    // If we already booted with max split-screen screens (players >= maxPlayers via URL), disable immediately
    if (playersCount >= maxPlayers) {
      lockButtonActive();
    }

    btn.onmouseenter = () => {
      if (btn.disabled) return;
      btn.style.transform = 'translate(-50%, -50%) scale(1.05)';
      btn.style.backgroundColor = '#0b8043';
    };
    btn.onmouseleave = () => {
      if (btn.disabled) return;
      btn.style.transform = 'translate(-50%, -50%) scale(1)';
      btn.style.backgroundColor = '#0f9d58';
    };

    btn.onclick = () => {
      const nextPlayerIndex = iframes.length + 1;
      if (nextPlayerIndex > maxPlayers) {
        return; // Safety guard
      }

      console.log(
        `📱 [Fake SDK] Dynamically adding Player ${nextPlayerIndex}...`,
      );
      const newCount = nextPlayerIndex;

      // Disable and style the button if max players reached
      if (newCount >= maxPlayers) {
        lockButtonActive();
      }

      // 1. Update Layout
      updateGridLayout(newCount);

      // 2. Spawn & Append Guest Iframe
      const newIframe = spawnPlayerIframe(`player-${newCount}`, newCount);
      container.appendChild(newIframe);
      iframes.push(newIframe);

      // 3. Broadcast to Host to append a player slot
      parentChannel.postMessage({
        type: 'ADD_PLAYER_SLOT',
        totalPlayers: newCount,
      });

      // 4. Load content into the guest iframe after a brief delay
      setTimeout(() => {
        newIframe.srcdoc = injectGlobals(html, `player-${newCount}`, newCount);
      }, 100);

      // 5. Start/Reset the connection watchdog
      startWatchdog(newCount);

      // 6. Cleanup if conditions met
      checkAndCloseChannel();
    };

    document.body.appendChild(btn);
  }

  // --- Private Helpers ---

  private _createPlayer(
    id: string,
    name: string,
    isCurrent: boolean,
    isHost: boolean,
    score: number = 0,
  ) {
    return {
      playerId: id,
      displayName: name,
      avatarUrl:
        id === 'player-1'
          ? 'https://fonts.gstatic.com/s/i/productlogos/avatar_anonymous/v4/web-64dp/logo_avatar_anonymous_color_64dp.png'
          : 'https://fonts.gstatic.com/s/i/productlogos/android/v6/web-64dp/logo_android_color_64dp.png',
      isCurrentPlayer: isCurrent,
      isHost: isHost,
      score: score,
    };
  }

  private _getLobbyInfo(state: string) {
    const mappedPlayers = this.players.map((p) => ({
      ...p,
      isCurrentPlayer: p.playerId === this.myPlayerId,
    }));

    return {
      lobbyId: this.lobbyId,
      gameId: this.gameId,
      minPlayers: this.playersCount,
      maxPlayers: this.playersCount,
      state: state,
      status: state,
      players: mappedPlayers,
    };
  }

  private _broadcast(data: any) {
    if (this.channel) {
      this.channel.postMessage(data);
    }
  }

  private _handleChannelMessage(data: any) {
    if (!data || !data.type) return;

    switch (data.type) {
      case 'ADD_PLAYER_SLOT':
        const newTotal = data.totalPlayers;
        console.log(
          `➕ [Fake SDK] Host received ADD_PLAYER_SLOT. Updating total players to ${newTotal}`,
        );
        this.playersCount = newTotal;

        // Add placeholder for the new player if it doesn't exist
        const newPlayerId = `player-${newTotal}`;
        if (!this.players.some((p) => p.playerId === newPlayerId)) {
          const newPlayer = this._createPlayer(
            newPlayerId,
            `Player ${newTotal} (Waiting...)`,
            false,
            false,
          );
          this.players.push(newPlayer);

          // Trigger presence join for the placeholder
          this._triggerPresence('JOIN', newPlayer);

          // Broadcast updated lobby
          this._broadcast({
            type: 'LOBBY_UPDATED',
            players: this.players,
          });
        }
        break;

      case 'PLAYER_JOINED_REQUEST':
        if (this.isHost) {
          const guestId = data.playerId;
          const guestNum = guestId.split('-')[1];
          console.log(`👤 [Fake SDK] Guest ${guestId} connected.`);

          const guest = this.players.find((p) => p.playerId === guestId);
          if (guest && guest.displayName.includes('Waiting')) {
            guest.displayName = `Player ${guestNum} (Active)`;

            this._broadcast({
              type: 'LOBBY_UPDATED',
              players: this.players,
            });

            this._triggerPresence('JOIN', guest);

            // Check if ALL players are now active (no placeholder contains 'Waiting')
            const allActive = this.players.every(
              (p) => !p.displayName.includes('Waiting'),
            );
            if (allActive) {
              console.log(
                '🚀 [Fake SDK] All players active. Autostarting game...',
              );
              setTimeout(() => this.startGame(), 500);
            }
          }
        }
        break;

      case 'LOBBY_UPDATED':
        if (!this.isHost) {
          console.log('📝 [Fake SDK] Lobby updated from host:', data.players);
          this.players = data.players;

          // Clear the handshake interval once we are accepted
          if (this.joinIntervalId) {
            const me = this.players.find((p) => p.playerId === this.myPlayerId);
            if (me && !me.displayName.includes('Waiting')) {
              const guestNum = this.myPlayerId.split('-')[1];
              console.log(
                `📡 [Fake SDK] Player ${guestNum} connection successful. Stopping pings.`,
              );
              clearInterval(this.joinIntervalId);
              this.joinIntervalId = null;
            }
          }

          // Trigger presence join for any active guest
          const meInLobby = this.players.find(
            (p) => p.playerId === this.myPlayerId,
          );
          if (meInLobby) this._triggerPresence('JOIN', meInLobby);
        }
        break;

      case 'START_GAME':
        if (!this.isHost) {
          console.log('🎬 [Fake SDK] Received start game signal.');
          if (this.joinIntervalId) {
            clearInterval(this.joinIntervalId);
            this.joinIntervalId = null;
          }
          this._triggerLobbyStatus('GAME_IN_PROGRESS');
        }
        break;

      case 'GAME_EVENT':
        if (data.from !== this.myPlayerId) {
          console.log(
            '📥 [Fake SDK] Received game event from opponent:',
            data.event,
          );
          if (this.onGameEvent) {
            this.onGameEvent(data.event);
          }
        }
        break;

      case 'SCORE_UPDATED':
        console.log('🏆 [Fake SDK] Opponent score updated:', data.scoreData);
        const playerToUpdate = this.players.find(
          (p) => p.playerId === data.playerId,
        );
        if (playerToUpdate) {
          playerToUpdate.score = data.scoreData.value || 0;
          console.log(
            `📝 [Fake SDK] Synchronized ${data.playerId} score to ${playerToUpdate.score}`,
          );
        }
        break;

      case 'LEVEL_COMPLETE':
        console.log(`⭐ [Fake SDK] Opponent completed level: ${data.level}`);
        break;

      case 'PAUSE_STATE_CHANGED':
        console.log(
          `⏸️ [Fake SDK] Peer pause state changed: isPaused=${data.isPaused}`,
        );
        break;

      case 'GAME_OVER':
        console.log('🛑 [Fake SDK] Received game over signal.');
        this._triggerLobbyStatus('GAME_ENDED');
        this._showMockLeaderboard();
        break;
    }
  }

  private _triggerPresence(action: 'JOIN' | 'LEAVE', player: any) {
    if (this.onPlayerPresence) {
      const mappedPlayer = {
        ...player,
        isCurrentPlayer: player.playerId === this.myPlayerId,
      };
      this.onPlayerPresence({
        action,
        status: 'SUCCESS',
        player: mappedPlayer,
      });
    }
  }

  private _triggerLobbyStatus(status: string) {
    if (this.onLobbyStatus) {
      this.onLobbyStatus({
        status,
        lobbyId: this.lobbyId,
      });
    }
  }
}
