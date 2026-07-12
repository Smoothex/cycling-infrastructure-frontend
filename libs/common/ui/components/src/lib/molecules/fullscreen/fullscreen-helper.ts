export function getOverlayTarget(): HTMLElement | string {
    if (typeof document !== 'undefined' && document.fullscreenElement) {
        return document.fullscreenElement as HTMLElement;
    }
    return 'body';
}