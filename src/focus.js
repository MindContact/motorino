// The page losing the player's attention: the tab hidden, or the window
// losing focus (another app, a notification, a phone call). A game pauses
// on `lost`, so its world does not go on without the player. `hidden` and
// `shown` follow only the tab, for the sound, which can keep playing while
// another window has the focus.
export function watchFocus({ lost = null, hidden = null, shown = null } = {}) {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (lost) lost();
      if (hidden) hidden();
    } else if (shown) {
      shown();
    }
  });
  window.addEventListener('blur', () => { if (lost) lost(); });
}
