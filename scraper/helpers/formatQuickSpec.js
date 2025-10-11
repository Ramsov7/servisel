/**
 * Simple heuristics to derive quickSpec from detailSpec when missing.
 * This is conservative and only fills known fields if found.
 */
export function formatQuickSpecFromDetail(detailSpec) {
    const findValue = (categoryName, keyName) => {
        const cat = (detailSpec || []).find(c => c.category.toLowerCase() === categoryName.toLowerCase());
        if (!cat) return '';
        const spec = (cat.specifications || []).find(s => s.name.toLowerCase().includes(keyName.toLowerCase()));
        if (!spec) return '';
        return Array.isArray(spec.value) ? spec.value.join('\n') : (spec.value || '');
    };

    return [
        { name: 'Display size', value: findValue('Display', 'size') },
        { name: 'Display resolution', value: findValue('Display', 'resolution') },
        { name: 'Camera pixels', value: findValue('Main Camera', 'pixel') || findValue('Main Camera', 'camera') },
        { name: 'Video pixels', value: findValue('Main Camera', 'video') },
        { name: 'RAM size', value: findValue('Memory', 'ram') },
        { name: 'Chipset', value: findValue('Platform', 'chipset') || findValue('Platform', 'soc') },
        { name: 'Battery size', value: findValue('Battery', 'capacity') || findValue('Battery', 'size') },
        { name: 'Battery type', value: findValue('Battery', 'type') }
    ];
}
