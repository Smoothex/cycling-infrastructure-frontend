import { Component, input, HostListener, signal, model, effect} from '@angular/core';
import { Drawer } from 'primeng/drawer';
import { Button } from 'primeng/button';
import { SettingsComponent } from './settings'
import { SettingGroup } from '../../lib/common/interfaces';
import { getOverlayTarget } from '@simra/common-components';

@Component({
  selector: 'intersection-settings-drawer',
  standalone: true,
  imports: [Button, Drawer, SettingsComponent],
  templateUrl: './settings-drawer.html'
})
export class SettingsDrawerComponent {
  visible = model.required<boolean>();
  fullscreenMode = model.required<boolean>();
  screenshotMode = model.required<boolean>();
  settings = input.required<SettingGroup[]>();

  isSettingsVisible = signal(false);
  setSettingVisibility(visible: boolean) {
    this.isSettingsVisible.set(visible);
  }

  @HostListener('window:keydown.escape')
  handleKeyDown() {
    if (this.screenshotMode()) {
      this.screenshotMode.set(false);
    }
  }

  constructor () {
    effect(() => {
      // Close draer on fullscreen change
      this.fullscreenMode();
      this.visible.set(false)
    })
  }

  getOverlayTarget = getOverlayTarget;
}