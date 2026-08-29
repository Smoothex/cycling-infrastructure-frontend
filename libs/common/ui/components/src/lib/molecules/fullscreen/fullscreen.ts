import { Directive, ElementRef, inject, model } from '@angular/core';
import { effect } from '@angular/core';

@Directive({
    selector: '[appFullscreen]',
    standalone: true,
    exportAs: 'appFullscreen'
})
export class FullscreenDirective {
    private el = inject(ElementRef);
    fullscreenMode = model<boolean>(false);

    constructor() {
        effect(() => {
            const targetState = this.fullscreenMode();
            const currentState = !!document.fullscreenElement;

            if (targetState && !currentState) {
                this.el.nativeElement.requestFullscreen()
                .catch((err) => {
                    console.error(`Error enabling fullscreen: ${err.message}`);
                    this.fullscreenMode.set(false); // Reset signal if blocked
                });
            } else if (!targetState && currentState) {
                document.exitFullscreen();
            }
        });

        this.el.nativeElement.onfullscreenchange = () => {
            const isCurrentlyFullscreen = !!document.fullscreenElement;
        
            if (isCurrentlyFullscreen !== this.fullscreenMode()) {
                this.fullscreenMode.set(isCurrentlyFullscreen);
            }
        };
    }
}