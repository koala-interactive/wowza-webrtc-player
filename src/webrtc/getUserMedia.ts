export function getUserMedia(
  constraints: MediaStreamConstraints
): Promise<MediaStream> {
  if (navigator.mediaDevices?.getUserMedia) {
    return navigator.mediaDevices.getUserMedia(constraints);
  }

  if (navigator.getUserMedia) {
    return new Promise((resolve, reject) => {
      navigator.getUserMedia(constraints, resolve, reject);
    });
  }

  return Promise.reject('Your browser does not support getUserMedia API');
}
