let currentDrag = null;

export function setCurrentDrag(payload) {
  currentDrag = payload;
}

export function getCurrentDrag() {
  return currentDrag;
}

export function clearCurrentDrag() {
  currentDrag = null;
}




