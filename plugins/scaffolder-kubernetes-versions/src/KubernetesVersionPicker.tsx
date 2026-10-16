import { useEffect, useState } from 'react';
import {
  discoveryApiRef,
  fetchApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import { makeFieldSchema } from '@backstage/plugin-scaffolder-react';
import FormControl from '@material-ui/core/FormControl';
import FormHelperText from '@material-ui/core/FormHelperText';
import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import Select from '@material-ui/core/Select';

export const KubernetesVersionPickerFieldSchema = makeFieldSchema({
  output: z => z.string(),
  uiOptions: z =>
    z.object({
      distribution: z
        .enum(['kubernetes', 'k0s'])
        .describe('Releases to offer, kubernetes for kubeadm or k0s'),
    }),
});

type MinorVersion = {
  minor: string;
  version: string;
};

type Versions =
  | { state: 'loading' }
  | { state: 'loaded'; versions: MinorVersion[] }
  | { state: 'failed'; message: string };

// offers the minors of the kubernetes-versions backend plugin, the value is
// the newest patch release of the selected minor
export const KubernetesVersionPicker = ({
  onChange,
  formData,
  schema,
  uiSchema,
  idSchema,
  rawErrors,
  required,
  disabled,
}: typeof KubernetesVersionPickerFieldSchema.TProps) => {
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const distribution = uiSchema['ui:options']?.distribution ?? 'kubernetes';
  const [versions, setVersions] = useState<Versions>({ state: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setVersions({ state: 'loading' });

    (async () => {
      const baseUrl = await discoveryApi.getBaseUrl('kubernetes-versions');
      const response = await fetchApi.fetch(`${baseUrl}/${distribution}`);
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      return (await response.json()) as MinorVersion[];
    })().then(
      loaded =>
        !cancelled && setVersions({ state: 'loaded', versions: loaded }),
      (error: Error) =>
        !cancelled && setVersions({ state: 'failed', message: error.message }),
    );

    return () => {
      cancelled = true;
    };
  }, [discoveryApi, fetchApi, distribution]);

  const options = versions.state === 'loaded' ? versions.versions : [];
  const offered = options.some(option => option.version === formData);
  const value = offered ? formData : '';

  // the form can hold a version that is not offered (anymore), e.g. after
  // "Start Over" or from ?formData= once a newer patch release came out. It is
  // removed, so the user has to pick a version they have seen
  useEffect(() => {
    if (versions.state !== 'loading' && formData && !offered) {
      onChange(undefined);
    }
  }, [versions.state, formData, offered, onChange]);
  const labelId = `${idSchema?.$id}-label`;

  let helperText = schema.description;
  if (versions.state === 'loading') {
    helperText = 'Loading the Kubernetes versions…';
  } else if (versions.state === 'failed') {
    helperText = `Failed to load the Kubernetes versions: ${versions.message}`;
  } else if (options.length === 0) {
    helperText = 'No Kubernetes versions available';
  }

  return (
    <FormControl
      margin="normal"
      required={required}
      disabled={disabled || versions.state !== 'loaded'}
      error={versions.state === 'failed' || (rawErrors?.length ?? 0) > 0}
      fullWidth
    >
      <InputLabel id={labelId}>
        {schema.title ?? 'Kubernetes Version'}
      </InputLabel>
      <Select
        labelId={labelId}
        value={value}
        onChange={event => onChange(String(event.target.value))}
      >
        {options.map(option => (
          <MenuItem key={option.version} value={option.version}>
            {option.minor}
          </MenuItem>
        ))}
      </Select>
      {helperText && <FormHelperText>{helperText}</FormHelperText>}
    </FormControl>
  );
};
