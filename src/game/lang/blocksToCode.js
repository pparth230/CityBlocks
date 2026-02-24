const TAB = '\t'

export function blocksToCode(blocks, indent = 0) {
  if (!blocks || blocks.length === 0) return ''
  const prefix = TAB.repeat(indent)
  return blocks.map(b => {
    switch (b.type) {
      case 'plant':
        return `${prefix}plant("${b.args.crop ?? 'wheat'}")`
      case 'harvest':
        return `${prefix}harvest()`
      case 'move':
        return `${prefix}move("${b.args.dir ?? 'right'}")`
      case 'bag':
        return `${prefix}bag()`
      case 'wait':
        return `${prefix}wait(${b.args.seconds ?? 1})`
      case 'repeat': {
        const header = `${prefix}for i in range(${b.args.count ?? 3}):`
        const body = blocksToCode(b.children ?? [], indent + 1)
        return body ? `${header}\n${body}` : `${header}\n${prefix}${TAB}wait(0)`
      }
      case 'while': {
        const header = `${prefix}while ${b.args.cond ?? 'True'}:`
        const body = blocksToCode(b.children ?? [], indent + 1)
        return body ? `${header}\n${body}` : `${header}\n${prefix}${TAB}wait(0)`
      }
      case 'call':
        return `${prefix}${b.args.name ?? 'routine'}()`
      default:
        return ''
    }
  }).filter(Boolean).join('\n')
}
