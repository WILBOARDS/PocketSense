import { BackBar } from '../components/common';
import { ParkForm } from '../components/ParkForm';
import { tr } from '../lib/i18n';
import { useUi, type ParkPrefill } from '../ui';

export function Thinking({ prefill }: { prefill?: ParkPrefill }) {
  const { go } = useUi();
  return (
    <div className="screen-fill">
      <BackBar title={prefill?.url ? tr('Park it', 'Parkir dulu') : tr('Thinking of buying', 'Mau beli sesuatu')} onBack={() => go('home')} />
      <ParkForm prefill={prefill} />
    </div>
  );
}
