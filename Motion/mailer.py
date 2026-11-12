"""Outgoing email over SMTP (stdlib smtplib + STARTTLS).

Configured by env vars, read on every send so changes need no code edits:
  SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASSWORD, MAIL_FROM

If SMTP_HOST or MAIL_FROM is missing, nothing is sent and nothing crashes:
with DEV_MAIL_TO_CONSOLE=1 the message is printed to the terminal (local
development only), otherwise a warning is logged.
"""
import logging
import os
import smtplib
import ssl
from email.message import EmailMessage

logger = logging.getLogger(__name__)

SMTP_TIMEOUT_SECONDS = 15


def is_configured():
    return bool(os.environ.get('SMTP_HOST') and os.environ.get('MAIL_FROM'))


def send_mail(to, subject, text, html=None):
    """Send one email. Returns True if it was handed to the SMTP server.

    Never raises: callers run this in a background thread.
    """
    if not is_configured():
        if os.environ.get('DEV_MAIL_TO_CONSOLE') == '1':
            # Dev fallback: the only place a reset link may be printed
            print(f'\n--- DEV_MAIL_TO_CONSOLE: email not sent ---\n'
                  f'To: {to}\nSubject: {subject}\n\n{text}\n'
                  f'--- end of email ---\n', flush=True)
        else:
            logger.warning('Email not sent: SMTP is not configured '
                           '(set SMTP_HOST and MAIL_FROM, or DEV_MAIL_TO_CONSOLE=1)')
        return False

    msg = EmailMessage()
    msg['Subject'] = subject
    msg['From'] = os.environ['MAIL_FROM']
    msg['To'] = to
    msg.set_content(text)
    if html:
        msg.add_alternative(html, subtype='html')

    host = os.environ['SMTP_HOST']
    port = int(os.environ.get('SMTP_PORT', 587))
    user = os.environ.get('SMTP_USER')
    password = os.environ.get('SMTP_PASSWORD')
    try:
        with smtplib.SMTP(host, port, timeout=SMTP_TIMEOUT_SECONDS) as smtp:
            smtp.starttls(context=ssl.create_default_context())
            if user:
                smtp.login(user, password or '')
            smtp.send_message(msg)
        return True
    except (smtplib.SMTPException, OSError) as e:
        # Log the error type only: the message body holds the reset link
        logger.error('Sending email via %s:%s failed: %s', host, port, type(e).__name__)
        return False
