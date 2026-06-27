import py_compile, pathlib
p=pathlib.Path(r'c:\\work\\English study\\English-Study\\app.py')
py_compile.compile(str(p), doraise=True)
print('py_compile OK')
