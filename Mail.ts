import * as Mailer from 'nodemailer';
import * as Fs from 'fs';
import smtpTransport from 'nodemailer-smtp-transport';
import { hostname } from 'os';
import { info, debug, error } from './Log';

export interface ISmtpConfig {
  smtp: {
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    secure?: boolean;
    from?: string;
    disabled: boolean;
  };
  gmail: {
    type?: string;
    user?: string;
    clientId?: string;
    clientSecret?: string;
    refreshToken?: string;
    disabled: boolean;
  };
  mailTo: string;
  replyTo: string;
  batchPeriodM?: number;
  batchMaxMessages?: number;
}

export interface IMessage {
  subject: string;
  body: string;
  priority?: 'high' | 'low';
  attachements?: any[];
  on?: Date;
}

export class Mail {
  protected _template = '<p><!-- body --></p><p><!-- timeStamp --></p>';

  constructor(protected _config: ISmtpConfig) {
    if (!this._config.smtp) this._config.smtp = { disabled: true };

    if (this._config.smtp.disabled === true) return; // don't analyze config if disabled

    if (!this._config.smtp) throw new Error(`[smtp] not set`);
    if (!this._config.smtp.host) throw new Error(`[smtp.host] not set`);
    if (!this._config.smtp) throw new Error(`[smtp.port] not set`);

    try {
      this._template = Fs.readFileSync('Template.html', 'utf8');
    } catch {
      info(`Template.html not found`);
    }
  }

  configChanged() {
    if (!this._config.mailTo) throw new Error(`[mailTo] not set`);
  }

  async send(message: IMessage) {
    if (this._config.smtp.disabled === true) {
      debug('mail sending is disbled in config');
      return;
    }

    const temp = {
      host: this._config.smtp.host,
      port: this._config.smtp.port,
      tls: { rejectUnauthorized: false },
      secure: this._config.smtp.secure === true,
      auth: null
    };

    if (this._config.smtp.user)
      temp.auth = {
        user: this._config.smtp.user,
        pass: this._config.smtp.password
      };

    const transport = Mailer.createTransport(temp),
      headers = {};

    if (message.priority) headers['importance'] = message.priority;

    await transport.sendMail({
      to: this._config.mailTo,
      from: this._config.smtp.from || this._config.smtp.user, // use from, if not set -> user
      replyTo: this._config.replyTo,
      subject: `pm2-health-custom: ${hostname()}, ${message.subject}`,
      html: this._template
        .replace(/<!--\s*body\s*-->/, message.body)
        .replace(/<!--\s*timeStamp\s*-->/, new Date().toISOString()),
      attachments: message.attachements,
      headers
    });
  }
}

export class GMail extends Mail {
  constructor(_config: ISmtpConfig) {
    super(_config);

    if (!this._config.gmail) this._config.gmail = { disabled: true };

    if (this._config.gmail.disabled === true) return; // don't analyze config if disabled

    if (!this._config.gmail) throw new Error(`[gmail] not set`);
    if (!this._config.gmail.type) throw new Error(`[smtp.type] not set`);
    if (!this._config.gmail.clientId)
      throw new Error(`[smtp.clientId] not set`);
    if (!this._config.gmail.clientSecret)
      throw new Error(`[smtp.clientSecret] not set`);
    if (!this._config.gmail.user) throw new Error(`[smtp.user] not set`);
    if (!this._config.gmail.refreshToken)
      throw new Error(`[smtp.refreshToken] not set`);
  }

  async send(message: IMessage) {
    if (this._config.gmail.disabled === true) {
      debug('mail sending is disbled in config');
      return;
    }

    const auth = {
      type: 'oauth2',
      user: this._config.gmail.user,
      clientId: this._config.gmail.clientId,
      clientSecret: this._config.gmail.clientSecret,
      refreshToken: this._config.gmail.refreshToken
    };

    const transport = Mailer.createTransport(
      smtpTransport({
        service: 'gmail',
        auth: auth
      })
    );
    const headers = {};

    if (message.priority) headers['importance'] = message.priority;

    await transport.sendMail({
      to: this._config.mailTo,
      from: this._config.smtp.from || this._config.smtp.user, // use from, if not set -> user
      replyTo: this._config.replyTo,
      subject: `pm2-health-custom: ${hostname()}, ${message.subject}`,
      html: this._template
        .replace(/<!--\s*body\s*-->/, message.body)
        .replace(/<!--\s*timeStamp\s*-->/, new Date().toISOString()),
      attachments: message.attachements,
      headers
    });
  }
}
