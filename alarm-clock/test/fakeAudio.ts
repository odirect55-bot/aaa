/**
 * Stand-in for `expo-audio`. Records what the ringing screen asked for so the
 * tests can assert on playback without a native audio session.
 */

export const fakeAudioState = {
  players: [] as FakePlayer[],
  audioMode: null as Record<string, unknown> | null,
};

export function __resetAudio(): void {
  fakeAudioState.players = [];
  fakeAudioState.audioMode = null;
}

class FakePlayer {
  loop = false;
  volume = 1;
  playing = false;
  released = false;

  constructor(public readonly source: unknown) {}

  play(): void {
    this.playing = true;
  }

  pause(): void {
    this.playing = false;
  }

  remove(): void {
    this.playing = false;
    this.released = true;
  }
}

export function createAudioPlayer(source: unknown): FakePlayer {
  const player = new FakePlayer(source);
  fakeAudioState.players.push(player);
  return player;
}

export async function setAudioModeAsync(mode: Record<string, unknown>): Promise<void> {
  fakeAudioState.audioMode = mode;
}

export type AudioPlayer = FakePlayer;
export type AudioSource = unknown;
