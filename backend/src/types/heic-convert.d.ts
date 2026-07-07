declare module 'heic-convert' {
  function convert(options: {
    buffer: Buffer;
    format: 'JPEG' | 'PNG';
    quality?: number;
  }): Promise<ArrayBuffer>;

  namespace convert {
    function all(options: {
      buffer: Buffer;
      format: 'JPEG' | 'PNG';
      quality?: number;
    }): Promise<{ convert: () => Promise<ArrayBuffer> }[]>;
  }

  export = convert;
}
