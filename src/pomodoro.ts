import { StatusBarAlignment, StatusBarItem, window } from "vscode";

enum PomodoroStatus {
  none,
  work,
  rest,
  paused,
  break,
  done,
}

const time = {
  pomodoro: 25,
  shortbreak: 5,
  second: 1000,
  minute: 60,
};

class Timer {
  private _timerId: any;
  public get isRunning() {
    return this._timerId !== null;
  }

  constructor(
    public currentTime: number = 0,
    public interval: number = time.second
  ) {
    this._timerId = null;
  }

  public reset(time: number) {
    this.stop();
    this.currentTime = time;
  }

  public start(callback: { (): void; (): void }) {
    if (this._timerId === null) {
      this._timerId = setInterval(() => {
        this.tick();
        callback();
      }, this.interval);
    } else {
      console.error("A timer instance is already running...");
    }
  }

  public stop() {
    if (this._timerId !== null) {
      clearInterval(this._timerId);
    }

    this._timerId = null;
  }

  private tick() {
    this.currentTime -= this.interval / time.second;
  }
}

class Pomodoro {
  // properties
  private _status: PomodoroStatus = PomodoroStatus.none;

  public get status() {
    return this._status;
  }
  public set status(status: PomodoroStatus) {
    this._status = status;
  }

  private _timer: Timer;

  public get timer() {
    return this._timer;
  }

  // events
  public onTick: (() => void) | undefined;

  constructor(
    public workTime: number = time.pomodoro * time.minute,
    public pauseTime: number = time.shortbreak * time.minute
  ) {
    this.workTime = Math.floor(this.workTime);
    this.pauseTime = Math.floor(this.pauseTime);

    this._timer = new Timer();
    this.status = PomodoroStatus.none;
  }

  // private methods
  private done() {
    this.stop();
    this.status = PomodoroStatus.done;
  }

  private resetTimer(status: PomodoroStatus) {
    if (status === PomodoroStatus.work) {
      this.timer.reset(this.workTime);
    }
    if (status === PomodoroStatus.rest) {
      this.timer.reset(this.pauseTime);
    }
  }

  // public methods
  public start(status: PomodoroStatus = PomodoroStatus.work) {
    if (status === PomodoroStatus.work || status === PomodoroStatus.rest) {
      if (this.status !== PomodoroStatus.paused) {
        this.resetTimer(status);
      }

      this.status = status;

      this._timer.start(() => {
        // stop the timer if no second left
        if (this.timer.currentTime <= 0) {
          if (this.status === PomodoroStatus.work) {
            window.showInformationMessage("work done! Take a break.");
            this.start(PomodoroStatus.rest);
          } else if (this.status === PomodoroStatus.rest) {
            window.showInformationMessage("Pause is over.");
            this.done();
          }
        }

        if (this.onTick) {
          this.onTick();
        }
      });
    } else {
      console.error("Start timer error");
    }
  }

  public pause() {
    this.stop();
    this.status = PomodoroStatus.paused;
  }

  public reset() {
    this.stop();
    this.status = PomodoroStatus.none;
    this._timer.currentTime = this.workTime;
  }

  public stop() {
    this._timer.stop();
  }

  public dispose() {
    this.stop();
    this.status = PomodoroStatus.none;
  }
}

class PomodoroManager {
  // logic properties
  private _pomodoroIndex: number = 0;
  public pomodori: Pomodoro[] = [];

  public get currentPomodoro() {
    return this.pomodori[this._pomodoroIndex];
  }

  public get currentState() {
    switch (this.currentPomodoro.status) {
      case PomodoroStatus.work:
        return " - work";
      case PomodoroStatus.rest:
        return " - rest";
      case PomodoroStatus.paused:
        return " - paused";
      case PomodoroStatus.break:
        return " - break";
      default:
        return "";
    }
  }

  public get isSessionFinished(): boolean {
    return !this.currentPomodoro;
  }

  // UI properties
  private _statusBarText: StatusBarItem;
  private _statusBarStartButton: StatusBarItem;
  private _statusBarPauseButton: StatusBarItem;
  private _statusBarResetButton: StatusBarItem;

  constructor(
    public workTime: number = time.pomodoro,
    public pauseTime: number = time.shortbreak
  ) {
    // create status bar items
    this._statusBarText = window.createStatusBarItem(StatusBarAlignment.Left);
    this._statusBarText.show();

    this._statusBarStartButton = window.createStatusBarItem(
      StatusBarAlignment.Left
    );
    this._statusBarStartButton.text = "$(triangle-right)";
    this._statusBarStartButton.command = "extension.startPomodoro";
    this._statusBarStartButton.tooltip = "Start Pomodoro";

    this._statusBarPauseButton = window.createStatusBarItem(
      StatusBarAlignment.Left
    );
    this._statusBarPauseButton.text = "$(primitive-square)";
    this._statusBarPauseButton.command = "extension.pausePomodoro";
    this._statusBarPauseButton.tooltip = "Pause Pomodoro";

    this._statusBarResetButton = window.createStatusBarItem(
      StatusBarAlignment.Left
    );
    this._statusBarResetButton.text = "$(debug-restart)";
    this._statusBarResetButton.command = "extension.resetPomodoro";
    this._statusBarResetButton.tooltip = "Reset Pomodoro";

    this.reset();
    this.draw();
  }

  // private methods
  private update() {
    // handle launch of the next Pomodoro
    if (this.currentPomodoro.status === PomodoroStatus.done) {
      this._pomodoroIndex++;

      if (!this.isSessionFinished) {
        this.start();
      }
    }
  }

  private draw() {
    if (this.isSessionFinished) {
      // show text when all Pomodoro sessions are over
      this._statusBarText.text = "restart session?";
      this._statusBarStartButton.show();
      this._statusBarPauseButton.hide();

      // show message if user needs a longer break
      if (this.pomodori.length > 1) {
        window.showInformationMessage(
          "Well done! You should now take a longer break."
        );
      }

      return;
    }

    const seconds = this.currentPomodoro.timer.currentTime % 60;
    const minutes = (this.currentPomodoro.timer.currentTime - seconds) / 60;

    // update status bar (text)
    const timerPart =
      (minutes < 10 ? "0" : "") +
      minutes +
      ":" +
      (seconds < 10 ? "0" : "") +
      seconds;

    let pomodoroNumberPart = "";
    if (this.pomodori.length > 1) {
      pomodoroNumberPart +=
        " (" +
        (this._pomodoroIndex + 1) +
        " out of " +
        this.pomodori.length +
        " pomodori)";
    }

    this._statusBarText.text =
      timerPart + this.currentState + pomodoroNumberPart;

    if (this.currentPomodoro.status === PomodoroStatus.none) {
      this._statusBarStartButton.show();
      this._statusBarPauseButton.hide();
      this._statusBarResetButton.hide();
    } else if (this.currentPomodoro.status === PomodoroStatus.paused) {
      this._statusBarStartButton.show();
      this._statusBarPauseButton.hide();
      this._statusBarResetButton.show();
    } else {
      this._statusBarStartButton.hide();
      this._statusBarPauseButton.show();
      this._statusBarResetButton.show();
    }

    this._statusBarText.show();
  }

  // public methods
  public start() {
    // launch a new session if the previous is already finished
    if (this.isSessionFinished) {
      this._pomodoroIndex = 0;
    }

    this.currentPomodoro.start();
    this.currentPomodoro.onTick = () => {
      this.update();
      this.draw();
    };
  }

  public pause() {
    this.currentPomodoro.pause();

    this.update();
    this.draw();
  }

  public reset() {
    this._pomodoroIndex = 0;
    this.pomodori = [];

    this.pomodori.push(new Pomodoro(this.workTime * 60, this.pauseTime * 60));
  }

  public dispose() {
    // stop current Pomodoro
    this.currentPomodoro.dispose();

    // reset UI
    this._statusBarText.dispose();
    this._statusBarStartButton.dispose();
    this._statusBarPauseButton.dispose();
    this._statusBarResetButton.dispose();
  }
}

export default PomodoroManager;
