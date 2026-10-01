import type { RealtimeChannel, Message } from 'ably';

interface MeshSignalData {
  from: string;
  to?: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

// Simplified WebRTC Mesh network manager for disaster mode
export class WebRTCMesh {
  private peers: Map<string, RTCPeerConnection> = new Map();
  private dataChannels: Map<string, RTCDataChannel> = new Map();
  private localId: string;
  private ablyChannel: RealtimeChannel; // Used just for signaling

  constructor(localId: string, ablyChannel: RealtimeChannel) {
    this.localId = localId;
    this.ablyChannel = ablyChannel;

    // Listen for signaling messages
    void this.ablyChannel.subscribe('mesh-signal', (message: Message) => {
      const { from, to, sdp, candidate } = message.data as MeshSignalData;
      if (to === this.localId) {
        void this.handleSignal(from, sdp, candidate);
      }
    });
  }

  // Broadcast presence to find peers in range
  discoverPeers() {
    void this.ablyChannel.publish('mesh-discover', { from: this.localId });
  }

  private async handleSignal(peerId: string, sdp?: RTCSessionDescriptionInit, candidate?: RTCIceCandidateInit) {
    let pc = this.peers.get(peerId);
    if (!pc) {
      pc = this.createPeer(peerId);
    }

    if (sdp) {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      if (sdp.type === 'offer') {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.sendSignal(peerId, { sdp: pc.localDescription as RTCSessionDescriptionInit });
      }
    } else if (candidate) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  private createPeer(peerId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal(peerId, { candidate: event.candidate.toJSON() });
      }
    };

    // Data channel for sync
    const dc = pc.createDataChannel('mesh-sync');
    this.setupDataChannel(peerId, dc);

    pc.ondatachannel = (event) => {
      this.setupDataChannel(peerId, event.channel);
    };

    this.peers.set(peerId, pc);
    return pc;
  }

  private setupDataChannel(peerId: string, dc: RTCDataChannel) {
    dc.onopen = () => { console.log(`[Mesh] Data channel opened with ${peerId}`); };
    dc.onmessage = (event) => {
      console.log(`[Mesh] Sync data from ${peerId}:`, event.data);
      this.processSyncData(JSON.parse(event.data as string) as unknown);
    };
    this.dataChannels.set(peerId, dc);
  }

  private sendSignal(to: string, payload: Partial<MeshSignalData>) {
    void this.ablyChannel.publish('mesh-signal', {
      from: this.localId,
      to,
      ...payload
    } as MeshSignalData);
  }

  public async initiateConnection(peerId: string) {
    const pc = this.createPeer(peerId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.sendSignal(peerId, { sdp: pc.localDescription as RTCSessionDescriptionInit });
  }

  public broadcast(data: unknown) {
    const message = JSON.stringify(data);
    this.dataChannels.forEach((dc) => {
      if (dc.readyState === 'open') {
        dc.send(message);
      }
    });
  }

  private processSyncData(data: unknown) {
    // Write received data to IndexedDB or merge with local state
    // E.g., Offline emergency alerts
    console.log('[Mesh] Processing synced data:', data);
  }
}
