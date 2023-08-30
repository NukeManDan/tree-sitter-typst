// any sequence alternating `zeb` and `ra`, like the black and white of a zebra
// in theory, `zeb` and `ra` are interchangeable, in practice, the order matters
// for instance, in a math group, the `zeb` must be `expr` and `ra` must be `ws`
// the reason why it behaves this way is unclear, although I suspect the `ws` in
// math operators to mislead the parser when a `ws` is found after an `expr`
function zebra(zeb, ra) {
  return seq(optional(ra), repeat(seq(zeb, ra)), optional(zeb));
}
// a list
function joined(elem, sep) {
  return seq(repeat(seq(elem, sep)), elem);
}
// extras
function ws($) {
  return repeat(choice($._space_expr, $.comment));
}

function content($) {
  return zebra(
    choice($._line_content, $._indented),
    seq(optional($._redent), choice($.break, $._new_line)),
  );
}
function new_line($) {
  return seq(optional($._redent), choice($.break, $._new_line));
}

function inside($) {
  return seq(
    repeat(choice($._space, $.comment, $._markup)),
    optional(seq(
      new_line($),
      repeat(seq(choice($._line_inside, $._indented), new_line($))),
      optional(choice($._line_inside, $._indented)),
    )),
  );
}

module.exports = grammar({
  name: 'typst',
  extras: $ => [],
  externals: $ => [
    // identation
    $._indent,
    $._dedent,
    $._redent,

    // other
    $._url_token,
    // $._barrier_in,
    // $._barrier_out,

    // delimited contexts
    $._content_token,
    $._strong_token,
    $._emph_token,
    // $._head_token,
    // $._math_group_token,
    // $._math_bar_token,
    $._termination,
    // $._recovery,
  ],
  conflicts: $ => [
    // [$.source_file],
    // [$._indented],
    // [$.content],
    // [$.item, $.term, $.heading, $._markup],
    [$.strong],
    [$.emph],
    [$.tagged, $.import],
    [$._math_group, $._math_item_call],
    [$._math_group, $._math_call],
    // [$._math_group, $._math_group_open],
    [$._math_attach_sup, $._math_attach_sub],
    [$.math],
    [$.math, $._math_ws_prefix],
    [$._math_group, $._math_ws_prefix],
    [$._math_abs, $._math_ws_prefix],
    [$._math_group],
    [$._math_abs],
    [$.item],
    [$._code],
    [$.let],
    [$.elude],
    [$.return],
    [$.return_inline],
    [$._code, $.field],
  ],
  rules: {
    source_file: $ => content($),

    _preline: $ => repeat1(choice($._space, $.comment)),

    _line_content: $ => choice(
      seq($._preline, optional($._theline_content)),
      $._theline_content
    ),
    _line_inside: $ => choice(
      seq($._preline, optional($._theline_inside)),
      $._theline_inside
    ),

    _theline_content: $ => choice(
      $.heading,
      $.item,
      $.term,
      seq($._markup, repeat(choice($._space, $.comment, $._markup))),
    ),
    _theline_inside: $ => choice(
      seq(
        choice($.heading, $.item, $.term),
        new_line($),
      ),
      seq($._markup, repeat(choice($._space, $.comment, $._markup))),
    ),

    // ends an expression
    _token_dlim: $ => /[ ]*(\n|;)/,
    // ends an expression in a block
    // the precedence of 1 is required
    // TODO: check if it is ok to use it also as token_dlim
    _token_dlim_blck: $ => token(prec(1, /[ ]*(\n|;)/)),

    break: $ => /\n([ \t]*\n)+/,
    escape: $ => /\\[^ \t\nu]|\\u\{[0-9a-fA-F]*\}/,
    comment: $ => choice(
      seq('//', /[^\n]*\n?/),
      seq('/*', repeat(choice(/[^\*\/]|\*[^\/]|\/[^\/\*]/, $.comment)), '*/'),
    ),
    url: $ => seq(/http(s?):\/\//, $._url_token),

    _space_expr: $ => /[ \n\t]+/,
    _new_line: $ => /\n/,
    _space: $ => /[ \t]+/,
    _token_eq: $ => token(prec(1, /=/)),

    // those are used to avoid matching the wrong input
    _anti_else: $ => /[ \n\t]*else[^ \t\{\[]/,
    _anti_markup: $ => /[\p{L}0-9][_\*\"][\p{L}0-9]/,
    _anti_item: $ => prec(1, /(-|\+|[0-9]+\.)[^ \t\n]/),
    _anti_head: $ => /=+[^ \t\n=]/,

    _token_item: $ => prec(1, /-|\+|[0-9]+\./),
    _token_term: $ => prec(1, /\/[ \t]+/),
    _token_head: $ => /=+/,
    _token_else: $ => /[ \n\t]*else/,
    _token_dot: $ => /\./,
    line: $ => /\\/,
    quote: $ => choice('"', '\''),

    // this regex is placed at the end to let all the previous ones match in priority
    _char_any: $ => /./,

    _markup: $ => choice(
      $._code,
      $.text,
      $.strong,
      $.emph,
      // $._space,
      // $.comment,
      $.raw_blck,
      $.raw_span,
      $.math,
      $.url,
      $.label,
      $.ref,
      $.symbol,
      $.quote,
      $.line,
    ),

    text: $ => prec.right(repeat1(choice(
      $._anti_else,
      $._anti_markup,
      $._anti_item,
      $._anti_head,
      $._token_dot,
      $._char_any,
      $.escape,
    ))),

    _indented: $ => seq($._indent, content($), $._dedent),
    item: $ => prec.right(1, seq(
      // TODO: move this space/comment to `content` repeat
      // repeat(choice($.comment, $._space)),
      $._token_item,
      // $._barrier_in,
      repeat(choice($._markup, $.comment, $._space)),
      optional($._indented),
      // $._barrier_out,
    )),
    term: $ => prec.right(1, seq(
      // repeat(choice($.comment, $._space)),
      $._token_term,
      field('term', repeat($._markup)),
      ':',
      repeat(choice($._markup, $.comment, $._space)),
      optional($._indented)
    )),

    // TODO: try again barrier
    heading: $ => prec.right(1, seq(
      // repeat(choice($.comment, $._space)),
      $._token_head,
      repeat(choice($._markup, $.comment, $._space)),
    )),
    strong: $ => prec.left(seq($._strong_token, inside($), $._termination)),
    emph: $ => prec.left(seq($._emph_token, inside($), $._termination)),
    raw_blck: $ => seq('```', field('lang', optional($.ident)), alias(/[^`a-zA-Z](``[^`]|`[^`]|[^`])*/, $.blob), '```'),
    raw_span: $ => seq('`', alias(/[^`]*/, $.blob), '`'),
    symbol: $ => choice('--', '---', '-?', '~', '...'),

    math: $ => seq('$', ws($), repeat($._math_expr), '$'),
    _math_code: $ => prec(8, seq('#', choice($._item, $._stmt), optional($._token_dlim))),
    _math_expr: $ => choice(
      $._math_code,
      $.line,
      alias($._math_group, $.group),
      alias($._math_group_open, $.group),
      alias($._math_abs, $.group),
      alias($._math_letter, $.variable),
      alias($._math_number, $.number),
      alias($._math_symbol, $.symbol),
      alias($._math_fac, $.fac),
      alias($._math_mul, $.mul),
      alias($._math_div, $.div),
      alias($._math_add, $.add),
      alias($._math_sub, $.sub),
      alias($._math_attach_sup, $.attach),
      alias($._math_attach_sub, $.attach),
      alias($._math_item_call, $.item_call),
      alias($._math_call, $.call),
      $._math_ws_prefix,
      $._math_ws_suffix,
      $._math_item,
    ),
    _math_ws_prefix:  $ => prec(6, seq(choice($.comment, $._space_expr), $._math_expr)),
    _math_ws_suffix:  $ => prec(5, seq($._math_expr, choice($.comment, $._space_expr))),
    _math_group:      $ => prec(1, seq(choice('(', '[', '{', '[|'), ws($), repeat($._math_expr), choice(')', ']', '}', '|]'))),
    _math_group_open: $ => prec.right(0, seq(choice('(', '[', '{', '[|'), ws($), repeat($._math_expr))),
    _math_abs:        $ => prec(-1, seq(choice('||', '|'), ws($), repeat($._math_expr), optional(token(prec(1, choice('||', '|')))))),
    _math_item:       $ => choice(alias($._math_ident, $.ident), alias($._math_field, $.field)),
    _math_token_sub: $ => token(prec(1, '_')),
    _math_ident_continue: $ => /\p{XID_Continue}/,
    _math_ident_start: $ => /\p{XID_Start}/,
    _math_ident: $ => prec.right(20, seq($._math_ident_start, repeat1(choice($._math_ident_start, $._math_ident_continue)))),
    _math_letter: $ => choice($._math_ident_start, $.escape, $.string),
    _math_number: $ => /[0-9]+/,
    _math_fac: $ => prec.left(4, seq($._math_expr, '!')),
    _math_mul: $ => prec.left(3, seq($._math_expr, '*', $._math_expr)),
    _math_div: $ => prec.left(3, seq($._math_expr, '/', $._math_expr)),
    _math_add: $ => prec.left(2, seq($._math_expr, '+', $._math_expr)),
    _math_sub: $ => prec.left(2, seq($._math_expr, '-', $._math_expr)),
    _math_attach_sup: $ => prec.right(4,
      seq($._math_expr, '^', field('sup', $._math_expr), optional(seq($._math_token_sub, field('sub', $._math_expr))))
    ),
    _math_attach_sub: $ => prec.right(4,
      seq($._math_expr, $._math_token_sub, field('sub', $._math_expr), optional(seq('^', field('sup', $._math_expr))))
    ),
    _math_field: $ => prec.left(7, seq($._math_item, '.', alias($._math_ident, $.ident))),
    _math_item_call: $ => prec(6, seq($._math_item, '(', ws($), repeat($._math_expr), ')')),
    _math_call: $ => prec(5, seq(choice(alias($._math_letter, $.variable), $._math_item), $._math_group)),
    _math_symbol: $ => token(prec(-1, choice(
      // ops
      '+', '-', '*', '/', '!',
      // arrow
      //   right
      '=>', '->', '|->', '->>', '-->', '~>', '~~>',
      //   left
      '<==', '<-', '<<-', '<--',
      //   both
      '<->', '<-->', '<=>', '<==>',
      // cmp
      //   eq
      '=', ':=', '::=', '=:', '!=',
      //   less
      '<=', '<', '<<', '<<<',
      //   greater
      '>=', '>', '>>', '>>>',
      // group
      ')', ']', '}', '|]', '||', '|',
      // other
      '&', '...', '@', '\'', '"', '?',
    ))),

    _code: $ => seq('#', choice($._item, $._stmt), optional($._token_dlim)),

    _item: $ => prec(1, choice(
      $.auto,
      $.none,
      $.flow,
      $.builtin,
      $.ident,
      $.label,
      $.bool,
      $.number,
      $.string,
      $.branch,
      $.field,
      $.block,
      $.group,
      $.call,
      $.content,
    )),

    _stmt: $ => choice(
      $.let,
      $.set,
      $.import,
      $.include,
      $.for,
      $.while,
      $.show,
      alias($.return_inline, $.return),
    ),

    _expr: $ => choice(
      $.auto,
      $.none,
      $.flow,
      $.builtin,
      $.ident,
      $.label,
      $.bool,
      $.number,
      $.string,
      $.branch,
      $.field,
      $.block,
      $.group,
      $.elude,
      $.assign,
      $.lambda,
      $.not,
      $.or,
      $.and,
      $.cmp,
      $.in,
      $.add,
      $.sub,
      $.mul,
      $.div,
      $.sign,
      $.call,
      $.content,
      $.let,
      $.set,
      $.import,
      $.include,
      $.for,
      $.while,
      $.show,
      $.return,
      $.tagged,
      $._expr_ws_prefix,
      $._expr_ws_suffix,
    ),

    _expr_ws_prefix: $ => prec(14, seq(choice($._space_expr, $.comment), $._expr)),
    _expr_ws_suffix: $ => prec(13, seq($._expr, choice($._space_expr, $.comment))),
    ident: $ => /[\p{XID_Start}_][\p{XID_Continue}\-]*/,
    unit: $ => choice('cm', 'mm', 'em', '%', 'fr', 'pt', 'in', 'deg', 'rad'),
    bool: $ => choice('true', 'false'),
    number: $ => prec.right(seq(/[0-9]+(\.[0-9]+)?/, optional($.unit))),
    string: $ => seq('"', repeat(choice(/[^\"\\]/, $.escape)), '"'),
    elude:  $ =>      prec(2, seq('..', optional($._expr), ws($))),
    assign: $ => prec.right(4, seq(field('pattern', $._expr), choice('=', '+=', '-=', '*=', '/='), field('value', $._expr))),
    lambda: $ => prec.right(5, seq(field('pattern', $._expr), '=>', field('value', $._expr))),
    or:     $ => prec.left(6, seq($._expr, 'or', $._expr)),
    not:    $ => prec.left(7, seq('not', $._expr)),
    and:    $ => prec.left(7, seq($._expr, 'and', $._expr)),
    cmp:    $ => prec.left(8, seq($._expr, choice('<', '>', '<=', '>=', '==', '!='), $._expr)),
    in:     $ => prec.left(9, seq($._expr, optional(seq('not', ws($))), 'in', $._expr)), 
    add:    $ => prec.left(10, seq($._expr, '+', $._expr)),
    sub:    $ => prec.left(10, seq($._expr, '-', $._expr)),
    mul:    $ => prec.left(11, seq($._expr, '*', $._expr)),
    div:    $ => prec.left(11, seq($._expr, '/', $._expr)),
    sign:   $ =>      prec(12, seq(choice('+', '-'), $._expr)),

    call:   $ => seq(field('item', $._item), choice($.content, $.group)),
    field:  $ => seq($._item, $._token_dot, field('field', $.ident)),
    tagged: $ => prec.left(1, seq(field('field', $._expr), ':', $._expr)),
    label: $ => seq('<', /[\p{XID_Start}\-_][\p{XID_Continue}\-_]*/, '>'),
    ref: $ => seq('@', /[\p{XID_Start}\-_][\p{XID_Continue}\-_]*/),
    content: $ => seq($._content_token, content($), $._termination),
    group: $ => seq(
      '(',
      repeat(seq($._expr, ',')),
      ws($),
      optional($._expr),
      ')'
    ),
    block: $ => seq(
      '{',
      repeat(seq(
        prec.left(optional(choice($._expr, $.comment))),
        // this token has the precedence over regular new lines inside expression
        // that way, a new line is a separator between expressions
        $._token_dlim_blck,
        optional($._space_expr),
      )),
      optional(choice($._expr, $.comment, $._space_expr)),
      '}'
    ),
    branch: $ => prec.left(2, seq(
      'if',
      field('test', $._expr), 
      choice($.block, $.content),
      optional(seq(alias($._token_else, 'else'),
        ws($),
        choice($.block, $.content, $.branch)
      )),
    )),
    let: $ => prec.right(3, seq(
      'let',
      field('pattern', $._expr),
      optional(seq(
        ws($),
        $._token_eq,
        field('value', $._expr)
      )),
      ws($),
    )),
    set: $ => prec(0, seq(
      'set',
      ws($),
      $.call,
    )),
    import: $ => prec.right(1, seq(
      'import',
      $._expr,
      ws($),
      optional(seq(
        token(prec(10, ':')),
        repeat(seq($._expr, ',')),
        optional($._expr),
      )),
    )),
    include: $ => prec(0, seq(
      'include',
      $._expr,
    )),
    for: $ => seq(
      'for',
      field('pattern', $._expr),
      'in',
      field('value', $._expr),
      choice($.block, $.content),
    ),
    while: $ => seq(
      'while',
      field('test', $._expr),
      choice($.block, $.content),
    ),
    show: $ => seq(
      'show',
      ws($),
      optional(field('pattern', $._expr)),
      ':',
      field('value', $._expr),
    ),
    return: $ => seq('return', optional($._expr)),
    return_inline: $ => prec(-1, seq('return', optional(seq(ws($), choice($._stmt, $._item))))),
    flow: $ => choice('break', 'continue'),
    auto: $ => 'auto',
    none: $ => 'none',
    builtin: $ => choice(
      'align',
      'assert',
      'black',
      'blue',
      'bottom',
      'box',
      'center',
      'circle',
      'cmyk',
      'emph',
      'eval',
      'gray',
      'green',
      'grid',
      'h',
      'heading',
      'horizon',
      'image',
      'left',
      'link',
      'list',
      'locate',
      'luma',
      'max',
      'metadata',
      'min',
      'navy',
      'page',
      'pagebreak',
      'panic',
      'par',
      'parbreak',
      'purple',
      'query',
      'rect',
      'red',
      'regex',
      'repr',
      'rgb',
      'right',
      'rotate',
      'scale',
      'squate',
      'strong',
      'text',
      'top',
      'type',
      'v',
      'white',
    ),
  },
});

