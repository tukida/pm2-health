import { GMail as Mail, IMessage, ISmtpConfig } from './Mail';
import { debug, error } from './Log';

// todo: add messages persistance in case of crash

export class Notify {
  private readonly _mail: Mail;
  private _holdTill: Date = null;
  private _messages: IMessage[] = [];
  private _t: NodeJS.Timer;

  constructor(private readonly _config: ISmtpConfig) {
    this._mail = new Mail(this._config);
  }

  private get isEnabled() {
    return this._config.batchPeriodM > 0;
  }

  configChanged() {
    this._mail.configChanged();

    clearInterval(this._t);

    if (this.isEnabled) {
      debug(
        `message batching is enabled, period = ${this._config.batchPeriodM} minutes`
      );

      this._t = setInterval(async () => {
        if (this._messages.length > 0) await this.sendBatch();
      }, this._config.batchPeriodM * 60 * 1000);
    }
  }

  hold(till: Date) {
    this._holdTill = till;
  }

  private async sendBatch() {
    const snapshot = this._messages.slice(); // make snapshot of messages
    this._messages = [];

    let body = '',
      i = 1;

    for (const message of snapshot)
      body += `-------- ${i++} | ${
        message.subject
      } | ${message.on.toISOString()} --------<br/>${message.body}`;

    const temp: IMessage = {
      subject: `${snapshot[0].subject} (${snapshot.length} items)`,
      body,
      attachements: snapshot
        .filter((e) => e.attachements != null)
        .map((e) => e.attachements)
        .reduce((p, c) => p.concat(c), [])
    };

    try {
      await this._mail.send(temp);

      debug(`batch of ${snapshot.length} messages sent`);
    } catch (ex) {
      // restore messages if sent fail
      this._messages.unshift(...snapshot);

      error(`can't send batch mail -> ${ex.message || ex}`);
    }
  }

  async send(message: IMessage) {
    const t = new Date();

    message.on = t;

    if (this._holdTill != null && t < this._holdTill) return; // skip

    if (this.isEnabled && message.priority !== 'high') {
      debug(`message (batch) -> ${message.subject}`);

      this._messages.push(message);

      if (
        this._config.batchMaxMessages > 0 &&
        this._messages.length >= this._config.batchMaxMessages
      )
        await this.sendBatch();
    } else {
      debug(`message -> ${message.subject}`);

      try {
        await this._mail.send(message);
      } catch (ex) {
        error(`can't send mail -> ${ex.message || ex}`);
      }
    }
  }
}
