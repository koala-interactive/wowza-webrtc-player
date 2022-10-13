export function getUserMedia(
  constraints: MediaStreamConstraints
): Promise<MediaStream> {
  if (navigator.mediaDevices?.getUserMedia) {
    return navigator.mediaDevices.getUserMedia(constraints);
  }

  if ('getUserMedia' in navigator) {
    return new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
      // @ts-ignore: error because navigator.getUserMedia is deprecated
      navigator.getUserMedia(constraints, resolve, reject);
    });
  }

  return Promise.reject('Your browser does not support getUserMedia API');
}
