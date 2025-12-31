/**
 * ESC/POS Command Constants and Encoder
 */

export const COMMANDS = {
    LF: '\x0a', // Line feed
    ESC: '\x1b',
    GS: '\x1d',

    // Initialization
    INIT: '\x1b\x40',

    // Text formatting
    TXT_ALIGN: {
        LEFT: '\x1b\x61\x00',
        CENTER: '\x1b\x61\x01',
        RIGHT: '\x1b\x61\x02',
    },

    TXT_BOLD: {
        ON: '\x1b\x45\x01',
        OFF: '\x1b\x45\x00',
    },

    TXT_SIZE: {
        NORMAL: '\x1d\x21\x00',
        DOUBLE_HEIGHT: '\x1d\x21\x01',
        DOUBLE_WIDTH: '\x1d\x21\x10',
        DOUBLE_BOTH: '\x1d\x21\x11',
        BIG: '\x1d\x21\x11', // Alias for double both
        HUGE: '\x1d\x21\x22', // Even bigger if supported
    },

    // Cut
    CUT_FULL: '\x1d\x56\x00',
    CUT_PARTIAL: '\x1d\x56\x01',

    // Korean Encoding specific (EUC-KR is standard for older printers, UTF-8 for newer)
    // Most generic ESC/POS printers in Korea expect EUC-KR (CP949)
};

export class EscPosEncoder {
    private buffer: number[] = [];
    private encoder: TextEncoder;

    constructor() {
        this.encoder = new TextEncoder(); // Defaults to UTF-8
    }

    // Helper to append raw bytes
    private addBytes(bytes: number[] | Uint8Array) {
        if (bytes instanceof Uint8Array) {
            bytes.forEach(b => this.buffer.push(b));
        } else {
            this.buffer.push(...bytes);
        }
    }

    // Helper to append string commands
    private addString(cmd: string) {
        for (let i = 0; i < cmd.length; i++) {
            this.buffer.push(cmd.charCodeAt(i));
        }
    }

    /**
     * Initialize printer
     */
    initialize() {
        this.addString(COMMANDS.INIT);
        return this;
    }

    /**
     * Set text alignment
     */
    align(align: 'left' | 'center' | 'right') {
        switch (align) {
            case 'left': this.addString(COMMANDS.TXT_ALIGN.LEFT); break;
            case 'center': this.addString(COMMANDS.TXT_ALIGN.CENTER); break;
            case 'right': this.addString(COMMANDS.TXT_ALIGN.RIGHT); break;
        }
        return this;
    }

    /**
     * Set text bold
     */
    bold(active: boolean) {
        this.addString(active ? COMMANDS.TXT_BOLD.ON : COMMANDS.TXT_BOLD.OFF);
        return this;
    }

    /**
     * Set text size
     */
    size(size: 'normal' | 'height' | 'width' | 'big' | 'huge') {
        switch (size) {
            case 'normal': this.addString(COMMANDS.TXT_SIZE.NORMAL); break;
            case 'height': this.addString(COMMANDS.TXT_SIZE.DOUBLE_HEIGHT); break;
            case 'width': this.addString(COMMANDS.TXT_SIZE.DOUBLE_WIDTH); break;
            case 'big': this.addString(COMMANDS.TXT_SIZE.BIG); break;
            case 'huge': this.addString(COMMANDS.TXT_SIZE.HUGE); break;
        }
        return this;
    }

    /**
     * Add text.
     * NOTE: Web TextEncoder encodes to UTF-8. 
     * Many legacy POS printers require EUC-KR (CP949) for Korean.
     * If the printer supports specific code pages (Page 949), we might need a library like 'iconv-lite' 
     * but 'iconv-lite' is heavy for client-side.
     * 
     * Modern Epson/Star printers often support UTF-8 or can be configured.
     * For now, we will use basic TextEncoder (UTF-8) and assume printer supports it or we use English for critical parts.
     * *Critical*: If real Korean hardware requires CP949, we'll need a custom mapping or library.
     */
    text(content: string) {
        // Basic UTF-8 encoding
        const encoded = this.encoder.encode(content);
        this.addBytes(encoded);
        return this;
    }

    /**
     * Add text with new line
     */
    line(content: string = '') {
        this.text(content);
        this.addString(COMMANDS.LF);
        return this;
    }

    /**
     * Feed n lines
     */
    feed(lines: number = 1) {
        for (let i = 0; i < lines; i++) {
            this.addString(COMMANDS.LF);
        }
        return this;
    }

    /**
     * Cut paper
     */
    cut(partial: boolean = false) {
        this.addString(partial ? COMMANDS.CUT_PARTIAL : COMMANDS.CUT_FULL);
        return this;
    }

    /**
     * Get final byte array
     */
    encode(): Uint8Array {
        return new Uint8Array(this.buffer);
    }
}
