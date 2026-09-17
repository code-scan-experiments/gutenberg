import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { useDispatch, useSelect } from '@wordpress/data';
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

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;
const originalResizeObserver = globalThis.ResizeObserver;
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
	globalThis.ResizeObserver = class ResizeObserver {
		observe() {}
		unobserve() {}
		disconnect() {}
	};

	useSelect.mockImplementation( ( mapSelect ) =>
		typeof mapSelect === 'function'
			? mapSelect( () => selectors )
			: selectors
	);
	useDispatch.mockReturnValue( dispatchers );

	if ( ! URL.createObjectURL ) {
		URL.createObjectURL = vi.fn();
	}
	if ( ! URL.revokeObjectURL ) {
		URL.revokeObjectURL = vi.fn();
	}
	vi.spyOn( URL, 'createObjectURL' ).mockReturnValue( 'about:blank' );
	vi.spyOn( URL, 'revokeObjectURL' ).mockImplementation( () => {} );
} );

afterEach( () => {
	vi.restoreAllMocks();
	useSelect.mockReset();
	useDispatch.mockReset();
	document.documentElement.lang = '';
	document.documentElement.dir = '';
	if ( ! originalCreateObjectURL ) {
		delete URL.createObjectURL;
	} else {
		URL.createObjectURL = originalCreateObjectURL;
	}
	if ( ! originalRevokeObjectURL ) {
		delete URL.revokeObjectURL;
	} else {
		URL.revokeObjectURL = originalRevokeObjectURL;
	}
	if ( ! originalResizeObserver ) {
		delete globalThis.ResizeObserver;
	} else {
		globalThis.ResizeObserver = originalResizeObserver;
	}
} );

describe( 'Iframe', () => {
	it( 'copies the parent document language and direction into the iframe', async () => {
		// Set the parent document attributes before the iframe is initialized.
		document.documentElement.lang = 'fr-CA';
		document.documentElement.dir = 'rtl';

		// This test follows the jsdom JSX convention for rendering the component.
		// eslint-disable-next-line react/jsx-filename-extension
		render( <Iframe /> );
		// The iframe is queried directly to verify its document attributes.
		// eslint-disable-next-line testing-library/no-node-access
		const iframe = document.querySelector( 'iframe' );
		await act( async () => {
			await new Promise( ( resolve ) => setTimeout( resolve, 0 ) );
		} );

		// Trigger initialization of the iframe document after it has loaded.
		// eslint-disable-next-line testing-library/no-unnecessary-act -- the load handler updates React state.
		act( () => {
			fireEvent.load( iframe );
		} );

		expect( iframe.contentDocument.documentElement.lang ).toBe( 'fr-CA' );
		expect( iframe.contentDocument.dir ).toBe( 'rtl' );
	} );
} );
