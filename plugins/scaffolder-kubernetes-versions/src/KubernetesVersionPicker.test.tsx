import { useState } from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import {
  mockApis,
  renderInTestApp,
  TestApiProvider,
} from '@backstage/frontend-test-utils';
import {
  KubernetesVersionPicker,
  KubernetesVersionPickerFieldSchema,
} from './KubernetesVersionPicker';

type Props = typeof KubernetesVersionPickerFieldSchema.TProps;

const versions = [
  { minor: '1.36', version: 'v1.36.5' },
  { minor: '1.35', version: 'v1.35.9' },
];

// holds the form data like the scaffolder form does
function Field({
  distribution,
  initial,
  onChange,
}: {
  distribution: 'kubernetes' | 'k0s';
  initial?: string;
  onChange: (value?: string) => void;
}) {
  const [formData, setFormData] = useState(initial);
  const props = {
    formData,
    onChange: (value?: string) => {
      setFormData(value);
      onChange(value);
    },
    schema: { title: 'Kubernetes Version', description: 'Pick a minor' },
    uiSchema: { 'ui:options': { distribution } },
    idSchema: { $id: 'root_kubernetesVersion' },
    rawErrors: [],
    required: true,
  } as unknown as Props;

  return <KubernetesVersionPicker {...props} />;
}

function renderField(
  fetch: jest.Mock,
  distribution: 'kubernetes' | 'k0s' = 'kubernetes',
  initial?: string,
) {
  const onChange = jest.fn();

  renderInTestApp(
    <TestApiProvider
      apis={[
        [discoveryApiRef, mockApis.discovery({ baseUrl: 'http://backstage' })],
        [fetchApiRef, { fetch }],
      ]}
    >
      <Field
        distribution={distribution}
        initial={initial}
        onChange={onChange}
      />
    </TestApiProvider>,
  );

  return onChange;
}

describe('KubernetesVersionPicker', () => {
  it('requests the versions of the configured distribution', async () => {
    const fetch = jest
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(versions)));

    renderField(fetch, 'k0s');

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        'http://backstage/api/kubernetes-versions/k0s',
      ),
    );
  });

  it('shows the minors and selects the newest patch release', async () => {
    const fetch = jest
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(versions)));
    const onChange = renderField(fetch);

    await screen.findByText('Pick a minor');
    await userEvent.click(screen.getByRole('button'));
    const options = within(screen.getByRole('listbox')).getAllByRole('option');

    expect(options.map(option => option.textContent)).toEqual(['1.36', '1.35']);

    await userEvent.click(options[1]);

    expect(onChange).toHaveBeenCalledWith('v1.35.9');
  });

  it('removes a version from the form data that is not offered', async () => {
    const fetch = jest
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(versions)));

    const onChange = renderField(fetch, 'kubernetes', 'v1.36.4');

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(undefined));
    expect(screen.getByRole('button')).not.toHaveTextContent('1.36');
  });

  it('keeps an offered version from the form data', async () => {
    const fetch = jest
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(versions)));

    const onChange = renderField(fetch, 'kubernetes', 'v1.35.9');

    await screen.findByText('Pick a minor');
    expect(screen.getByRole('button')).toHaveTextContent('1.35');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows why the versions could not be loaded', async () => {
    const fetch = jest
      .fn()
      .mockResolvedValue(
        new Response('', { status: 503, statusText: 'Service Unavailable' }),
      );

    const onChange = renderField(fetch, 'kubernetes', 'v1.36.5');

    expect(
      await screen.findByText(
        'Failed to load the Kubernetes versions: 503 Service Unavailable',
      ),
    ).toBeInTheDocument();
    // without the list the version can't be checked
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
