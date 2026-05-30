import React from 'react';
import { TextInput as RNTextInput, StyleSheet, type TextInputProps } from 'react-native';

// 시스템 다크모드로 인해 TextInput 텍스트가 보이지 않는 문제를 전역에서 방지.
// 모든 페이지에서 이 컴포넌트를 react-native의 TextInput 대신 사용한다.
export function TextInput({ style, placeholderTextColor, ...props }: TextInputProps) {
  return (
    <RNTextInput
      placeholderTextColor={placeholderTextColor ?? '#94A3B8'}
      style={[styles.base, style]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    color: '#0F172A',
  },
});
