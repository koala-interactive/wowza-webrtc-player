# Wowza WebRTC Player

Easy to use **WebRTC** Player library to connect to **Wowza Media Server**.

[![license: MIT](https://img.shields.io/badge/license-MIT-brightgreen.svg)](https://opensource.org/licenses/MIT)
![lint](https://github.com/koala-interactive/wowza-webrtc-player/workflows/lint/badge.svg?branch=master)

---

## 🚀 Installation

Install with [yarn](https://yarnpkg.com):

    $ yarn add wowza-webrtc-player

Or install using [npm](https://npmjs.org):

    $ npm i wowza-webrtc-player

---

## Base code

To works, we need to create a **WowzaWebRTCPlayer** instance bound to a HTML5 video element.
The second parameters allows you to set different [options](#Options). You can change it later using `player.setConfigurations(options)`.

```ts
import { WowzaWebRTCPlayer } from 'wowza-webrtc-player';

const videoElement = document.querySelector('video');
const player = new WowzaWebRTCPlayer(videoElement, {
  sdpUrl: 'wss://zeezzrezrezr.streamlock.net/webrtc-session.json',
  applicationName: 'webrtc',
  streamName: 'myStream',
});
```

## As a publisher

#### 1. Play the camera locally.

It will ask for browser permission, and connect your camera to the video element.

```ts
await player.playLocal();
```

#### 2. Publish video to Wowza

```ts
await player.publish();
```

#### 3. Stop publishing the flux (but camera still active)

```ts
await player.stop();
```

#### 4. Stop the camera (and also stop publishing the flux)

```ts
await player.stopLocal();
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

---

---

## Access/Update mediaStream

```ts
const stream = player.getMediaStream();

player.attachStream(newStream);
```

---

## Extends/Replace SDP Mungle

```ts
player.setConfigurations({
  sdpHandler(sdp, originalHandler, type) {
    if (type === 'play') {
      // update sdp
      return originalHandler(sdp);
    } else if (type === 'publish') {
      // update sdp
      return originalHandler(sdp);
    }
  },
});
```

---

## Get Wowza running streams

_It need to be enabled in your Wowza server._

```ts
const streams = await player.getAvailableStreams();

streams.forEach((stream) => {
  console.log(
    stream.streamName,
    stream.codecAudio,
    stream.codecVideo,
    stream.readyAudio,
    stream.readyVideo
  );
});
```

---

## Options

| Key             | Type                                                                                                |                                                                                                                |
| --------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| applicationName | _`string`_                                                                                          | Your wowza app name (`"live"` or `"webrtc"` in Wowza documentation).                                           |
| streamName      | _`string`_                                                                                          | Your Wowza stream name (`"myStream"` in Wowza documentation)                                                   |
| sdpUrl          | _`string`_                                                                                          | Your Wowza websocket secured url (should looks like `"wss://zeezzrezrezr.streamlock.net/webrtc-session.json"`) | 
| constrains      | _[MediaStreamConstraints](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamConstraints)_ | `{ video: true, audio: true }`                                                                                 |
| iceServers      | _[RTCIceServer](https://developer.mozilla.org/en-US/docs/Web/API/RTCIceServer)_                     | List of your ICE server to connect to                                                                          |
| videoConfigs    | _`Object`_                                                                                          | `{ bitRate:360, codec:'VP8', frameRate: 29.97 }`                                                               |
| audioConfigs    | _`Object`_                                                                                          | `{ bitRate:64, codec:'opus' }`                                                                                 |                                |
| secureToken        | _`Object / null`_                                                                                   | `{"hash":"YOURHASHEDSECRET","starttime":0,"endtime":0}`                                 |
| userData        | _`Object / null`_                                                                                   | Can be used to send data to Wowza 
