import * as url from 'url';
import { toTypeName } from './validateIdentifier';

const resolveCache = new Map<string, string>();
const parseCache = new Map<string, url.Url>();

const SIMPLE_REFERENCE = /^[\w\-.~/#]*$/;
const DOT_SEGMENT = /(^|\/)\.\.?(\/|#|$)/;

function isSimpleReference(ref: string): boolean {
    return (
        SIMPLE_REFERENCE.test(ref) &&
        !DOT_SEGMENT.test(ref) &&
        !ref.startsWith('//')
    );
}

function simpleResolve(from: string, to: string): string | undefined {
    if (!isSimpleReference(from) || !isSimpleReference(to)) {
        return undefined;
    }
    if (to.startsWith('#')) {
        return from.split('#')[0] + to;
    }
    if (to.startsWith('/')) {
        return to;
    }
    return undefined;
}

function cachedResolve(from: string, to: string): string {
    const simple = simpleResolve(from, to);
    if (simple !== undefined) {
        return simple;
    }
    const key = `${from}\0${to}`;
    let resolved = resolveCache.get(key);
    if (resolved === undefined) {
        resolved = url.resolve(from, to);
        resolveCache.set(key, resolved);
    }
    return resolved;
}

function cachedParse(input: string): url.Url {
    let parsed = parseCache.get(input);
    if (parsed === undefined) {
        parsed = url.parse(input);
        parseCache.set(input, parsed);
    }
    return parsed;
}

export default class SchemaId {
    private readonly absoluteId: string;
    public readonly id: url.Url;
    public static readonly empty = new SchemaId('');

    constructor(
        public readonly inputId: string,
        parentIds?: string[],
    ) {
        let absoluteId = cachedResolve('', inputId);
        if (parentIds) {
            parentIds.forEach((parent: string) => {
                if (parent) {
                    absoluteId = cachedResolve(parent, absoluteId);
                }
            });
        }
        if (!absoluteId.includes('#')) {
            absoluteId += '#';
        }
        if (
            !absoluteId.includes('://') &&
            !absoluteId.startsWith('/') &&
            !absoluteId.startsWith('#')
        ) {
            absoluteId = '/' + absoluteId;
        }
        this.id = cachedParse(absoluteId);
        this.absoluteId = this.id.href;
    }

    public getAbsoluteId(): string {
        return this.absoluteId;
    }
    public isEmpty(): boolean {
        return !!this.absoluteId;
    }
    public isFetchable(): boolean {
        return /https?:\/\//.test(this.absoluteId);
    }
    public getFileId(): string {
        return this.absoluteId.replace(/#.*$/, '#');
    }
    public existsJsonPointerHash(): boolean {
        return this.absoluteId === '#' || this.absoluteId.includes('#/');
    }
    public getJsonPointerHash(): string {
        const m = /(#\/.*)$/.exec(this.absoluteId);
        if (m?.[1] == null) {
            return '#';
        }
        return decodeURIComponent(m[1]);
    }

    public toNames(): string[] {
        const uri = this.id;
        const ids: string[] = [];
        if (uri.host) {
            ids.push(decodeURIComponent(uri.host));
        }
        const addAllParts = (path: string): void => {
            const paths = path.split('/');
            if (paths.length > 1 && paths[0] === '') {
                paths.shift();
            }
            paths.forEach((item: string) => {
                ids.push(decodeURIComponent(item));
            });
        };
        if (uri.pathname) {
            addAllParts(uri.pathname);
        }
        if (uri.hash && uri.hash.length > 1) {
            addAllParts(uri.hash.substr(1));
        }
        return ids.map(toTypeName);
    }
}
