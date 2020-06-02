# Wowza WebRTC Player

Easy to use WebRTC Player library to connect to Wowza protocol.

#### TODO
- Complete the readme
- Ensure it's ready as a NPM package.
- Add a method to customize sdp enhancers
- Add documentation about `player.getAvailableStreams()`.
- Fixes various bugs
- Find a way to detect wowza disconnection
- Find a way to work with deprecated DOM methods using Typescript


## Base code
```ts
import { WowzaWebRTCPlayer } from 'wowza-webrtc-player';

const videoElement = document.querySelector('video');
const player = new WowzaWebRTCPlayer(videoElement, {
  sdpUrl: 'wss://zeezzrezrezr.streamlock.net/webrtc-session.json',
  applicationName: 'live',
  streamName: 'myStream'
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
