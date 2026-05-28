export function simulateSshConnection({ pemPath, connectionString, onLine, onDone }) {
  const lastBackslash = pemPath.lastIndexOf('\\');
  const pemDir = lastBackslash !== -1 ? pemPath.substring(0, lastBackslash) : 'C:\\Users\\Andre';
  const pemFile = lastBackslash !== -1 ? pemPath.substring(lastBackslash + 1) : 'key.pem';

  const atIndex = connectionString.indexOf('@');
  const user = atIndex !== -1 ? connectionString.substring(0, atIndex) : 'ubuntu';
  const host = atIndex !== -1 ? connectionString.substring(atIndex + 1) : connectionString;

  const timers = [];
  let totalDelay = 0;

  const schedule = (delay, line) => {
    totalDelay += delay;
    timers.push(setTimeout(() => onLine(line), totalDelay));
  };

  schedule(300, { type: 'cmd', prompt: 'C:\\Users\\Andre>', command: `cd ${pemDir}` });
  schedule(600, { type: 'cmd', prompt: `${pemDir}>`, command: `ssh -i "${pemFile}" ${user}@${host}` });

  schedule(2000, { type: 'blank' });

  schedule(100, { type: 'out', text: 'Welcome to Ubuntu 24.04.4 LTS (GNU/Linux 6.17.0-1009-aws x86_64)' });
  schedule(150, { type: 'blank' });
  schedule(30, { type: 'out', text: ' * Documentation:  https://help.ubuntu.com' });
  schedule(30, { type: 'out', text: ' * Management:     https://landscape.canonical.com' });
  schedule(30, { type: 'out', text: ' * Support:        https://ubuntu.com/pro' });
  schedule(200, { type: 'blank' });
  schedule(30, { type: 'out', text: ' System information as of Thu May 28 03:07:39 UTC 2026' });
  schedule(200, { type: 'blank' });
  schedule(30, { type: 'out', text: '  System load:  0.0                Temperature:           -273.1 C' });
  schedule(30, { type: 'out', text: '  Usage of /:   12.5% of 28.02GB   Processes:             115' });
  schedule(30, { type: 'out', text: '  Memory usage: 40%                Users logged in:       0' });
  schedule(30, { type: 'out', text: '  Swap usage:   0%                 IPv4 address for ens5: 172.31.19.136' });
  schedule(200, { type: 'blank' });
  schedule(30, { type: 'out', text: ' * Ubuntu Pro delivers the most comprehensive open source security and' });
  schedule(30, { type: 'out', text: '   compliance features.' });
  schedule(200, { type: 'blank' });
  schedule(30, { type: 'out', text: '   https://ubuntu.com/aws/pro' });
  schedule(200, { type: 'blank' });
  schedule(30, { type: 'out', text: 'Expanded Security Maintenance for Applications is not enabled.' });
  schedule(200, { type: 'blank' });
  schedule(30, { type: 'out', text: '36 updates can be applied immediately.' });
  schedule(30, { type: 'out', text: 'To see these additional updates run: apt list --upgradable' });
  schedule(200, { type: 'blank' });
  schedule(30, { type: 'out', text: 'Enable ESM Apps to receive additional future security updates.' });
  schedule(30, { type: 'out', text: 'See https://ubuntu.com/esm or run: sudo pro status' });
  schedule(400, { type: 'blank' });
  schedule(30, { type: 'out', text: '*** System restart required ***' });
  schedule(200, { type: 'out', text: 'Last login: Thu May 28 03:03:22 2026 from 181.55.20.15' });

  schedule(600, { type: 'cmd', prompt: 'ubuntu@ip-172-31-19-136:~$', command: 'ls' });
  schedule(400, { type: 'out', text: 'deploy  documents  scripts  src  data  logs  config' });
  schedule(300, { type: 'blank' });

  schedule(500, { type: 'cmd', prompt: 'ubuntu@ip-172-31-19-136:~$', command: 'exit' });
  schedule(200, { type: 'out', text: 'logout' });
  schedule(100, { type: 'out', text: `Connection to ${host} closed.` });
  schedule(300, { type: 'blank' });
  schedule(100, { type: 'idle', prompt: `${pemDir}>` });

  timers.push(setTimeout(() => {
    onDone?.();
  }, totalDelay + 500));

  return () => timers.forEach(clearTimeout);
}