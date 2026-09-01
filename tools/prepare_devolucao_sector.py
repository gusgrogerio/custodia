from pathlib import Path


def replace_once(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'Expected block not found in {path}: {old[:80]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


# Nova Custódia: allow explicit registration in the independent Devolução sector.
replace_once(
    'frontend/src/pages/NewCustody.js',
    "toast.error('Selecione a Região (São Paulo ou Guarulhos)');",
    "toast.error('Selecione o setor (Guarulhos, São Paulo ou Devolução)');",
)
replace_once(
    'frontend/src/pages/NewCustody.js',
    'Região <span className="text-red-400">*</span>',
    'Setor / Região <span className="text-red-400">*</span>',
)
replace_once(
    'frontend/src/pages/NewCustody.js',
    '<SelectValue placeholder="Selecione a região" />',
    '<SelectValue placeholder="Selecione o setor" />',
)
replace_once(
    'frontend/src/pages/NewCustody.js',
    '''                    <SelectItem value="Guarulhos" className="text-slate-200 focus:bg-slate-800 focus:text-slate-100 cursor-pointer">\n                      Guarulhos\n                    </SelectItem>''',
    '''                    <SelectItem value="Guarulhos" className="text-slate-200 focus:bg-slate-800 focus:text-slate-100 cursor-pointer">\n                      Guarulhos\n                    </SelectItem>\n                    <SelectItem value="Devolução" className="text-slate-200 focus:bg-slate-800 focus:text-slate-100 cursor-pointer">\n                      Devolução\n                    </SelectItem>''',
)

# User management: operators can be assigned directly to Devolução.
replace_once(
    'frontend/src/pages/UserManagement.js',
    'Operadores devem ser vinculados a uma região.',
    'Operadores devem ser vinculados a um setor ou região.',
)
replace_once(
    'frontend/src/pages/UserManagement.js',
    '>Região</Label>',
    '>Setor / Região</Label>',
)
replace_once(
    'frontend/src/pages/UserManagement.js',
    '''                    <SelectItem value="São Paulo" className="text-slate-200">São Paulo</SelectItem>''',
    '''                    <SelectItem value="São Paulo" className="text-slate-200">São Paulo</SelectItem>\n                    <SelectItem value="Devolução" className="text-slate-200">Devolução</SelectItem>''',
)
replace_once(
    'frontend/src/pages/UserManagement.js',
    'Admin acessa todas as regiões.',
    'Admin acessa Guarulhos, São Paulo e Devolução.',
)

print('Devolução sector prepared successfully.')
