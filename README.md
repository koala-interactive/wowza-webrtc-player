# Wowza WebRTC Player

Easy to use WebRTC Player library to connect to Wowza protocol.

[![license: MIT](https://img.shields.io/badge/license-MIT-brightgreen.svg)](https://opensource.org/licenses/MIT)
![lint](https://github.com/koala-interactive/wowza-webrtc-player/workflows/lint/badge.svg?branch=master)

#### TODO

- 📝 Add documentation about `player.getAvailableStreams()`.
- 📝 Add documentation about `player.setConfigurations()` - (`constraints`, `videoConfigs`, `audioConfigs`, `userData`, `iceServers`)
- 📦 Ensure it's ready as a NPM package.
- ✨ Find a way to detect wowza flux disconnection
- 🐛 Fix random publish failure (invalid codec no Safari desktopo/iOS)
- 🐛 Fix publish problem using Firefox desktop

## Base code

```ts
import { WowzaWebRTCPlayer } from 'wowza-webrtc-player';

const videoElement = document.querySelector('video');
const player = new WowzaWebRTCPlayer(videoElement, {
  sdpUrl: 'wss://zeezzrezrezr.streamlock.net/webrtc-session.json',
  applicationName: 'live',
  streamName: 'myStream',
});
```

## As a publisher

#### 1. Play the camera locally.

It will ask for permission, and connect your camera to the video element.

```ts
await player.playLocal();
```

#### 2. Publish it to Wowza

```ts
await player.publish();
```

#### 3. Stop the publication

```ts
await player.stop();
```

---

## As a Viewer

#### 1. Read the remote flux

```ts
await player.playRemote();
```

#### 2. Stop it

```ts
await player.stop();
```

## Extends/Replace SDP Mungle

```ts
player.setConfigurations({
  sdpHandler(sdp, originalHandler) {
    return originalHandler(sdp);
  },
});
```
