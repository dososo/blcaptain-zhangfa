import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const outIndex = process.argv.indexOf('--out');
const output = resolve(outIndex >= 0 ? process.argv[outIndex + 1] : resolve(root, 'release'));
await mkdir(output, { recursive: true });
const version = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')).version;
const name = `blcaptain-zhangfa-${version}.zip`;
const archive = resolve(output, name);
// 固定顺序、时间和权限，让相同技能内容生成相同归档。
execFileSync('python3', ['-c', `
import pathlib,zipfile,sys
root=pathlib.Path(sys.argv[1]); dest=sys.argv[2]
skill=root/'skills/blcaptain-zhangfa'
files=[(p,'blcaptain-zhangfa/'+p.relative_to(skill).as_posix()) for p in skill.rglob('*') if p.is_file()]
for legal in ['LICENSE','NOTICE']:
 name='blcaptain-zhangfa/'+legal
 if not any(item[1]==name for item in files): files.append((root/legal,name))
with zipfile.ZipFile(dest,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for src,name in sorted(files,key=lambda x:x[1]):
  if src.is_symlink(): raise ValueError('发布包不接受符号链接：'+name)
  info=zipfile.ZipInfo(name,date_time=(2026,10,29,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16
  z.writestr(info,src.read_bytes())
`, root, archive]);
const bytes = await readFile(archive);
const hash = createHash('sha256').update(bytes).digest('hex');
await writeFile(resolve(output, `${name}.sha256`), `${hash}  ${name}\n`);
console.log(JSON.stringify({ 文件: archive, 字节: bytes.length, sha256: hash }, null, 2));
