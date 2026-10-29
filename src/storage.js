// Saved data in localStorage under one key, as JSON. Reading never throws:
// a missing or broken save is an empty one.

export function createStore(key) {
  return {
    load() {
      try {
        return JSON.parse(localStorage.getItem(key)) || {};
      } catch {
        return {};
      }
    },
    save(data) {
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch {
        // Private mode or a full disk: the game goes on unsaved.
      }
    },
  };
}
