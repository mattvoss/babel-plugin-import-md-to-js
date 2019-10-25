const fs = require('fs')
const path = require('path')
const marked = require('marked')
const jsYaml = require('js-yaml')
const requireResolve = require('require-resolve')

const mdToJs = (md, convert) => {
  const props = {}
  let contents = md

  if (md.slice(0, 4) === '---\n') {
    const index = md.indexOf('---\n', 5)

    if (index > 0) {
      const yamlString = md.slice(0, index).substring(4)
      props = jsYaml.safeLoad(yamlString)
      contents = md.substring(index + 4)
    }
  }

  if (convert) {
    contents = marked(contents)
  }

  return Object.assign({}, props, { contents: contents })
}

const toTree = (t, obj) => {
  const props = []

  for (const key in obj) {
    let val = obj[key]

    if (val === null) {
      val = t.nullLiteral()
    } else {
      const type = typeof(val)

      if (type ===  'undefined') {
        continue
      }

      switch(type) {
        case 'string':
          val = t.stringLiteral(val)
          break

        case 'number':
          val = t.numericLiteral(val)
          break

        case 'boolean':
          val = t.booleanLiteral(val)
          break

        default:
          val = toTree(t, val)
      }
    }

    props.push(t.objectProperty(t.stringLiteral(key), val))
  }

  return t.objectExpression(props)
}

module.exports = (babel) => {
  const t = babel.types

  return {
    visitor: {
      ImportDeclaration: {
        // pretty much guessing what input paramters are called

        exit: (decl, file) => {
          const node = decl.node
          let pathname = node.source.value

          if (pathname.endsWith('.md')) {
            // everything you see here is a complete guesswork but
            // that is what you get without proper documentation -
            // #babel6

            const mod = requireResolve(pathname, path.resolve(file.file.opts.filename))
            const id = t.identifier(node.specifiers[0].local.name)
            const value = toTree(t, mdToJs(fs.readFileSync(mod.src).toString(), true)) // due to bugs we cannot use t.valueToNode

            decl.replaceWith(t.variableDeclaration('const', [t.variableDeclarator(id, value)]))
          } else if (pathname.endsWith('.md!')) {
            // everything you see here is a complete guesswork but
            // that is what you get without proper documentation -
            // #babel6

            pathname = pathname.slice(0, -1)

            const mod = requireResolve(pathname, path.resolve(file.file.opts.filename))
            const id = t.identifier(node.specifiers[0].local.name)
            const value = toTree(t, mdToJs(fs.readFileSync(mod.src).toString(), false)) // due to bugs we cannot use t.valueToNode

            decl.replaceWith(t.variableDeclaration('const', [t.variableDeclarator(id, value)]))
          }
        }
      }
    }
  }
}
