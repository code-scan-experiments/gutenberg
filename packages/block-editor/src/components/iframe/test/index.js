import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { useDispatch, useSelect } from '@wordpress/data';
import { createElement } from '@wordpress/element';
// eslint-disable-next-line import/no-extraneous-dependencies -- jsdom is provided by the unit test workspace.
import { JSDOM } from 'jsdom';
import Iframe from '../index';

vi.mock( import( '@wordpress/data' ), async ( importOriginal ) => ( {
	...( await importOriginal() ),
	useSelect: vi.fn(),
	useDispatch: vi.fn(),
} ) );

vi.mock( import( '../../../lock-unlock' ), () => ( {
	unlock: ( value ) =>
		new Proxy( value, {
			get( target, property ) {
				if (
					property === 'registerPrivateActions' ||
					property === 'registerPrivateSelectors'
				) {
					return () => {};
				}
				return target[ property ];
			},
		} ),
} ) );

let hadCreateObjectURL;
let hadRevokeObjectURL;
let dom;
const originalGlobals = new Map();
const selectors = new Proxy(
	{
		getSettings: () => ( {
			__internalIsInitialized: true,
			__unstableResolvedAssets: {},
			isPreviewMode: false,
		} ),
		hasMultiSelection: () => false,
		getSelectedBlockClientId: () => undefined,
		getSelectedBlockClientIds: () => [],
		getBlockCount: () => 0,
		getBlockOrder: () => [],
		getLastFocus: () => undefined,
		getSectionRootClientId: () => undefined,
		getEditedContentOnlySection: () => undefined,
		isZoomOut: () => false,
	},
	{
		get( target, property ) {
			return target[ property ] || vi.fn();
		},
	}
);
const dispatchers = new Proxy(
	{},
	{
		get: () => vi.fn(),
	}
);

beforeEach( () => {
	// Provide the DOM APIs needed by the rendered iframe in the node project.
	dom = new JSDOM( '<!doctype html><html><head></head><body></body></html>', {
		url: 'http://localhost/',
	} );
	for ( const key of [
		'window',
		'document',
		'navigator',
		'location',
		'HTMLElement',
		'Node',
		'Event',
		'MouseEvent',
		'KeyboardEvent',
		'FocusEvent',
		'CustomEvent',
		'URL',
		'Blob',
		'getComputedStyle',
	] ) {
		originalGlobals.set( key, globalThis[ key ] );
		Reflect.set( globalThis, key, dom.window[ key ] );
	}

	Reflect.set(
		window,
		'matchMedia',
		vi.fn( ( query ) => ( {
			matches: /prefers-reduced-motion/.test( query ),
			media: query,
			onchange: null,
			addListener: vi.fn(),
			addEventListener: vi.fn(),
			dispatchEvent: vi.fn(),
			removeListener: vi.fn(),
			removeEventListener: vi.fn(),
		} ) )
	);
	Reflect.set(
		globalThis,
		'ResizeObserver',
		class ResizeObserver {
			observe() {}
			unobserve() {}
			disconnect() {}
		}
	);

	useSelect.mockImplementation( ( mapSelect ) =>
		typeof mapSelect === 'function'
			? mapSelect( () => selectors )
			: selectors
	);
	useDispatch.mockReturnValue( dispatchers );

	hadCreateObjectURL = 'createObjectURL' in URL;
	hadRevokeObjectURL = 'revokeObjectURL' in URL;
	if ( ! hadCreateObjectURL ) {
		URL.createObjectURL = () => '';
	}
	if ( ! hadRevokeObjectURL ) {
		URL.revokeObjectURL = () => {};
	}
	vi.spyOn( URL, 'createObjectURL' ).mockReturnValue( 'blob:test' );
	vi.spyOn( URL, 'revokeObjectURL' ).mockImplementation( () => {} );
} );

afterEach( () => {
	vi.restoreAllMocks();
	useSelect.mockReset();

	if ( ! hadCreateObjectURL ) {
		delete URL.createObjectURL;
	}
	if ( ! hadRevokeObjectURL ) {
		delete URL.revokeObjectURL;
	}
	for ( const [ key, value ] of originalGlobals ) {
		Reflect.set( globalThis, key, value );
	}
	originalGlobals.clear();
	dom.window.close();
} );

describe( 'Iframe', () => {
	it( 'copies the parent document language and direction into the iframe', () => {
		// Set the parent document attributes before the iframe is initialized.
		document.documentElement.lang = 'fr-CA';
		document.documentElement.dir = 'rtl';

		render( createElement( Iframe ) );
		const iframe = document.querySelector( 'iframe' );

		// jsdom does not load blob URLs, so provide the iframe document directly.
		Object.defineProperty( iframe, 'contentDocument', {
			configurable: true,
			value: document.implementation.createHTMLDocument(),
		} );

		// Trigger initialization of the iframe document after it has loaded.
		fireEvent.load( iframe );

		expect( iframe.contentDocument.documentElement.lang ).toBe( 'fr-CA' );
		expect( iframe.contentDocument.dir ).toBe( 'rtl' );
	} );
} );
