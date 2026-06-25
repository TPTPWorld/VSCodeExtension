cmake_minimum_required(VERSION 3.18)

project(TPTPPrettyPrinter LANGUAGES C)

# provide clues to IDE IntelliSense
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# must run with emcmake
if(NOT EMSCRIPTEN)
  message(FATAL_ERROR "This target builds the bundled WASM runtime. Configure it with emcmake.")
endif()

include(FetchContent)

set(JJPARSER_GIT_REPO "https://github.com/jzxia/JJParser.git" CACHE STRING
  "JJParser repository used for the bundled local pretty-printer")
set(JJPARSER_GIT_TAG "jzxia__DISABLE_CURL_compiler_flag" CACHE STRING
  "JJParser branch or commit used for the bundled local pretty-printer")
set(TPTP_PRETTY_RUNTIME_DIR
  "${CMAKE_CURRENT_SOURCE_DIR}/../../client/resources/wasm"
  CACHE PATH
  "Directory where the packaged JS/WASM runtime is copied after build")

FetchContent_Declare(
  jjparser
  GIT_REPOSITORY "${JJPARSER_GIT_REPO}"
  GIT_TAG        "${JJPARSER_GIT_TAG}"

  # avoid building any targets defined in JJParser's own `CMakeLists.txt`
  SOURCE_SUBDIR  cmake-do-not-add
)

FetchContent_MakeAvailable(jjparser)

set(JJPARSER_SOURCES
  ListStatistics.c
  List.c
  Examine.c
  Modify.c
  Tree.c
  TreeStatistics.c
  ParseTPTP.c
  ParseTSTP.c
  PrintTSTP.c
  Parsing.c
  Signature.c
  Tokenizer.c
  Utilities.c
  Compare.c
  Interpret.c
  PrintXML.c
  PrintSMT2.c
  PrintDFG.c
  PrintOtter.c
  PrintKIF.c
  PrintSUMO.c
  PrintLP.c
  PrintDK.c
  FileUtilities.c
  SystemOnTPTP.c
  Statistics.c
)
list(TRANSFORM JJPARSER_SOURCES PREPEND "${jjparser_SOURCE_DIR}/")

add_executable(tptp4X_wasm
  src/tptp4X_api.c
  ${JJPARSER_SOURCES}
)

target_include_directories(tptp4X_wasm PRIVATE
  "${CMAKE_CURRENT_SOURCE_DIR}/src"
  "${jjparser_SOURCE_DIR}"
)

target_compile_definitions(tptp4X_wasm PRIVATE
  _GNU_SOURCE
  JJPARSER_DISABLE_CURL
)

target_compile_options(tptp4X_wasm PRIVATE
  -Wall
)

# Emscripten settings
target_link_options(tptp4X_wasm PRIVATE
  "SHELL:-s MODULARIZE=1"
  "SHELL:-s EXPORT_NAME=createTPTP4X"
  "SHELL:-s ALLOW_MEMORY_GROWTH=1"
  "SHELL:-s EXIT_RUNTIME=1"
  "SHELL:-s EXPORTED_FUNCTIONS=['_malloc','_free','_tptp4x_pretty_print_tptp','_tptp4x_free_string']"
  "SHELL:-s EXPORTED_RUNTIME_METHODS=['UTF8ToString','stringToUTF8','lengthBytesUTF8']"
)

# copy the packaged WASM runtime files so that they can be used by the TPTP VSCode extension
add_custom_command(TARGET tptp4X_wasm POST_BUILD
  COMMAND "${CMAKE_COMMAND}" -E make_directory "${TPTP_PRETTY_RUNTIME_DIR}"
  COMMAND "${CMAKE_COMMAND}" -E copy_if_different
    "$<TARGET_FILE:tptp4X_wasm>"
    "${TPTP_PRETTY_RUNTIME_DIR}/tptp4X_wasm.js"
  COMMAND "${CMAKE_COMMAND}" -E copy_if_different
    "$<TARGET_FILE_DIR:tptp4X_wasm>/tptp4X_wasm.wasm"
    "${TPTP_PRETTY_RUNTIME_DIR}/tptp4X_wasm.wasm"
)
