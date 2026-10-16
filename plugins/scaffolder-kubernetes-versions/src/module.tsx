import { createFrontendModule } from '@backstage/frontend-plugin-api';
import {
  createFormField,
  FormFieldBlueprint,
} from '@backstage/plugin-scaffolder-react/alpha';

// offers the versions of the kubernetes-versions backend plugin as dropdown
const kubernetesVersionPicker = FormFieldBlueprint.make({
  name: 'kubernetes-version-picker',
  params: {
    field: async () =>
      import('./KubernetesVersionPicker').then(m =>
        createFormField({
          name: 'KubernetesVersionPicker',
          component: m.KubernetesVersionPicker,
          schema: m.KubernetesVersionPickerFieldSchema,
        }),
      ),
  },
});

export const scaffolderKubernetesVersionsModule = createFrontendModule({
  pluginId: 'scaffolder',
  extensions: [kubernetesVersionPicker],
});
