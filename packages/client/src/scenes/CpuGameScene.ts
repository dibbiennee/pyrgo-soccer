import type { InputState, CharacterRef } from '@pyrgo/shared';
import { LocalGameScene } from './LocalGameScene';
import { CpuController } from '../objects/CpuController';
import type { CpuDifficulty } from '../objects/CpuController';

export class CpuGameScene extends LocalGameScene {
  private cpuController!: CpuController;
  private cpuDifficulty: CpuDifficulty = 'medium';

  constructor() {
    super('CpuGame');
  }

  init(data: { char1?: number; char2?: number; charRef1?: CharacterRef; charRef2?: CharacterRef; difficulty?: CpuDifficulty }): void {
    super.init(data);
    this.cpuDifficulty = data.difficulty ?? 'medium';
  }

  create(): void {
    super.create();
    this.cpuController = new CpuController(this.cpuDifficulty);
  }

  protected getP2Input(): InputState {
    return this.cpuController.getInput(
      this.player2,
      this.player1,
      this.ball,
      this.time.now,
    );
  }
}
