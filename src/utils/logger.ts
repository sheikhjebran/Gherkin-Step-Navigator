/**
 * Logger Utility
 * 
 * Provides logging functionality for the extension with different log levels.
 */

import * as vscode from 'vscode';

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

export class Logger {
    private outputChannel: vscode.OutputChannel;
    private logLevel: LogLevel = LogLevel.INFO;
    private name: string;

    constructor(name: string) {
        this.name = name;
        this.outputChannel = vscode.window.createOutputChannel(name);
    }

    private formatMessage(level: string, message: string): string {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] [${level}] ${message}`;
    }

    private log(level: LogLevel, levelName: string, message: string): void {
        if (level >= this.logLevel) {
            const formattedMessage = this.formatMessage(levelName, message);
            this.outputChannel.appendLine(formattedMessage);
            
            // Also log to console in development
            if (level === LogLevel.ERROR) {
                console.error(formattedMessage);
            } else if (level === LogLevel.WARN) {
                console.warn(formattedMessage);
            }
        }
    }

    debug(message: string): void {
        this.log(LogLevel.DEBUG, 'DEBUG', message);
    }

    info(message: string): void {
        this.log(LogLevel.INFO, 'INFO', message);
    }

    warn(message: string): void {
        this.log(LogLevel.WARN, 'WARN', message);
    }

    error(message: string): void {
        this.log(LogLevel.ERROR, 'ERROR', message);
    }

    setLogLevel(level: LogLevel): void {
        this.logLevel = level;
    }

    show(): void {
        this.outputChannel.show();
    }

    dispose(): void {
        this.outputChannel.dispose();
    }
}
